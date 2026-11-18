// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

/// @title AgentBoard
/// @notice Micro-bounty escrow board gated by Binance Agent ID (SPACE ID Agent ID,
///         ERC-721, non-transferable). A requester locks funds (BNB or ERC20) in
///         escrow. Only Agent ID holders can create, claim and work on bounties.
///         The requester releases funds after work is submitted. Worker
///         reputation is recorded on-chain, bound to the worker address.
/// @dev Single file, no imports. The reentrancy guard below is hand-written.
///      The Agent ID contract does NOT implement ERC721Enumerable, so this
///      contract NEVER calls tokenOfOwnerByIndex. Ownership is checked only
///      via balanceOf(address) > 0, and reputation is bound to the worker
///      address (safe because the token is non-transferable: one address
///      effectively maps to one Agent ID).
///      There is no owner and no privileged function: no pause, no mint, no
///      owner withdrawal, no upgrade. The contract only ever moves escrowed
///      bounty funds along the flows the involved users approved.
///      No platform fee is charged. No return of any kind is promised.

interface IAgentID {
    function balanceOf(address account) external view returns (uint256);
}

interface IERC20 {
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
    function transfer(address to, uint256 amount) external returns (bool);
}

contract AgentBoard {
    // ------------------------------------------------------------------------
    // Hand-written reentrancy guard (no imports)
    // ------------------------------------------------------------------------
    uint256 private constant _NOT_ENTERED = 1;
    uint256 private constant _ENTERED = 2;
    uint256 private _guardStatus;

    modifier nonReentrant() {
        require(_guardStatus != _ENTERED, "AgentBoard: reentrant call");
        _guardStatus = _ENTERED;
        _;
        _guardStatus = _NOT_ENTERED;
    }

    // ------------------------------------------------------------------------
    // Types
    // ------------------------------------------------------------------------
    enum Status {
        Open, // created, funds locked, waiting for a worker
        Claimed, // worker claimed, work in progress
        Submitted, // worker submitted proof, waiting for release
        Completed, // funds paid to worker
        Cancelled, // poster cancelled while Open, funds refunded
        Expired // deadline passed while Claimed without submit, funds refunded
    }

    struct Bounty {
        address poster;
        address worker;
        address paymentToken; // address(0) means BNB
        uint256 amount;
        uint256 deadline;
        uint256 claimedAt;
        uint256 submittedAt;
        Status status;
        string title;
        string description;
        string proof;
    }

    struct AgentStats {
        uint256 completed;
        uint256 earned;
    }

    // ------------------------------------------------------------------------
    // State
    // ------------------------------------------------------------------------
    /// @notice The Agent ID contract (SPACE ID Agent ID). Immutable, set once.
    address public immutable agentId;

    Bounty[] private _bounties;

    mapping(address => AgentStats) private _stats;
    /// @notice Bounties currently in Claimed state per worker address.
    mapping(address => uint256) private _activeClaims;

    /// @notice Timeout after submission: if the poster stays silent this long,
    ///         the worker may claim the escrowed funds themselves.
    uint256 public constant CLAIM_TIMEOUT = 3 days;

    // ------------------------------------------------------------------------
    // Events
    // ------------------------------------------------------------------------
    event BountyCreated(
        uint256 indexed id, address indexed poster, address indexed paymentToken, uint256 amount, uint256 deadline
    );
    event BountyClaimed(uint256 indexed id, address indexed worker);
    event WorkSubmitted(uint256 indexed id, address indexed worker, string proof);
    event PaymentReleased(uint256 indexed id, address indexed worker, uint256 amount);
    event BountyCancelled(uint256 indexed id, address indexed poster);
    event BountyExpired(uint256 indexed id, address indexed poster);
    event TimeoutClaimed(uint256 indexed id, address indexed worker, uint256 amount);

    // ------------------------------------------------------------------------
    // Constructor
    // ------------------------------------------------------------------------
    constructor(address agentId_) {
        require(agentId_ != address(0), "AgentBoard: agentId is zero address");
        agentId = agentId_;
        _guardStatus = _NOT_ENTERED;
    }

    // ------------------------------------------------------------------------
    // Core flows
    // ------------------------------------------------------------------------

    /// @notice Create a bounty and lock its funds in escrow.
    /// @param title Short bounty title.
    /// @param description What needs to be done.
    /// @param paymentToken address(0) for BNB, otherwise an ERC20 token address.
    /// @param amount Escrowed amount. For BNB, msg.value must equal amount.
    ///        For ERC20, the poster must approve this contract first.
    /// @param deadline Unix timestamp; must be in the future.
    /// @return id The new bounty id.
    function createBounty(
        string calldata title,
        string calldata description,
        address paymentToken,
        uint256 amount,
        uint256 deadline
    ) external payable nonReentrant returns (uint256 id) {
        require(hasAgentId(msg.sender), "AgentBoard: caller holds no Agent ID");
        require(amount > 0, "AgentBoard: amount is zero");
        require(deadline > block.timestamp, "AgentBoard: deadline not in future");

        if (paymentToken == address(0)) {
            require(msg.value == amount, "AgentBoard: BNB value must equal amount");
        } else {
            require(msg.value == 0, "AgentBoard: do not send BNB with ERC20 bounty");
        }

        id = _bounties.length;
        _bounties.push(
            Bounty({
                poster: msg.sender,
                worker: address(0),
                paymentToken: paymentToken,
                amount: amount,
                deadline: deadline,
                claimedAt: 0,
                submittedAt: 0,
                status: Status.Open,
                title: title,
                description: description,
                proof: ""
            })
        );

        // Event first: it only persists if the whole transaction succeeds,
        // so emitting before the external token call below is safe.
        emit BountyCreated(id, msg.sender, paymentToken, amount, deadline);

        if (paymentToken != address(0)) {
            require(
                IERC20(paymentToken).transferFrom(msg.sender, address(this), amount),
                "AgentBoard: ERC20 transferFrom failed"
            );
        }
    }

    /// @notice Claim an open bounty. Only Agent ID holders, never the poster.
    function claimBounty(uint256 id) external {
        require(hasAgentId(msg.sender), "AgentBoard: caller holds no Agent ID");
        Bounty storage bounty = _getBounty(id);
        require(bounty.status == Status.Open, "AgentBoard: bounty not open");
        require(block.timestamp <= bounty.deadline, "AgentBoard: deadline passed");
        require(msg.sender != bounty.poster, "AgentBoard: poster cannot claim own bounty");

        bounty.worker = msg.sender;
        bounty.claimedAt = block.timestamp;
        bounty.status = Status.Claimed;
        _activeClaims[msg.sender] += 1;

        emit BountyClaimed(id, msg.sender);
    }

    /// @notice Submit work for a claimed bounty. Only the worker.
    function submitWork(uint256 id, string calldata proof) external {
        Bounty storage bounty = _getBounty(id);
        require(bounty.status == Status.Claimed, "AgentBoard: bounty not claimed");
        require(msg.sender == bounty.worker, "AgentBoard: caller is not the worker");

        bounty.proof = proof;
        bounty.submittedAt = block.timestamp;
        bounty.status = Status.Submitted;
        _activeClaims[msg.sender] -= 1;

        emit WorkSubmitted(id, msg.sender, proof);
    }

    /// @notice Release escrowed funds to the worker. Only the poster.
    function releasePayment(uint256 id) external nonReentrant {
        Bounty storage bounty = _getBounty(id);
        require(bounty.status == Status.Submitted, "AgentBoard: work not submitted");
        require(msg.sender == bounty.poster, "AgentBoard: caller is not the poster");

        address worker = bounty.worker;
        address paymentToken = bounty.paymentToken;
        uint256 amount = bounty.amount;

        // Checks-effects-interactions: state updated before any external call.
        bounty.status = Status.Completed;
        _stats[worker].completed += 1;
        _stats[worker].earned += amount;

        emit PaymentReleased(id, worker, amount);

        _pay(worker, paymentToken, amount);
    }

    /// @notice Cancel an open bounty and refund the poster in full.
    function cancelBounty(uint256 id) external nonReentrant {
        Bounty storage bounty = _getBounty(id);
        require(bounty.status == Status.Open, "AgentBoard: bounty not open");
        require(msg.sender == bounty.poster, "AgentBoard: caller is not the poster");

        address poster = bounty.poster;
        address paymentToken = bounty.paymentToken;
        uint256 amount = bounty.amount;

        // Checks-effects-interactions: state updated before any external call.
        bounty.status = Status.Cancelled;

        emit BountyCancelled(id, poster);

        _pay(poster, paymentToken, amount);
    }

    /// @notice Refund the poster when a claimed bounty passes its deadline
    ///         without a submission. Callable by anyone.
    function refundExpired(uint256 id) external nonReentrant {
        Bounty storage bounty = _getBounty(id);
        require(bounty.status == Status.Claimed, "AgentBoard: bounty not claimed");
        require(block.timestamp > bounty.deadline, "AgentBoard: deadline not passed");

        address poster = bounty.poster;
        address worker = bounty.worker;
        address paymentToken = bounty.paymentToken;
        uint256 amount = bounty.amount;

        // Checks-effects-interactions: state updated before any external call.
        bounty.status = Status.Expired;
        _activeClaims[worker] -= 1;

        emit BountyExpired(id, poster);

        _pay(poster, paymentToken, amount);
    }

    /// @notice Let the worker claim escrowed funds when the poster stays silent
    ///         for CLAIM_TIMEOUT (3 days) after submission. Only the worker.
    function claimTimeout(uint256 id) external nonReentrant {
        Bounty storage bounty = _getBounty(id);
        require(bounty.status == Status.Submitted, "AgentBoard: work not submitted");
        require(msg.sender == bounty.worker, "AgentBoard: caller is not the worker");
        require(block.timestamp > bounty.submittedAt + CLAIM_TIMEOUT, "AgentBoard: timeout not reached");

        address worker = bounty.worker;
        address paymentToken = bounty.paymentToken;
        uint256 amount = bounty.amount;

        // Checks-effects-interactions: state updated before any external call.
        bounty.status = Status.Completed;
        _stats[worker].completed += 1;
        _stats[worker].earned += amount;

        emit TimeoutClaimed(id, worker, amount);

        _pay(worker, paymentToken, amount);
    }

    // ------------------------------------------------------------------------
    // Views
    // ------------------------------------------------------------------------

    /// @notice Full bounty record. Reverts for an unknown id.
    function getBounty(uint256 id) external view returns (Bounty memory) {
        return _getBounty(id);
    }

    /// @notice Number of bounties ever created.
    function bountyCount() external view returns (uint256) {
        return _bounties.length;
    }

    /// @notice True when the address holds at least one Agent ID.
    function hasAgentId(address account) public view returns (bool) {
        return IAgentID(agentId).balanceOf(account) > 0;
    }

    /// @notice Worker reputation: completed bounties, total earned, and
    ///         bounties currently claimed (in Claimed state).
    function agentStats(address account)
        external
        view
        returns (uint256 completed, uint256 earned, uint256 activeClaimed)
    {
        AgentStats storage stats = _stats[account];
        return (stats.completed, stats.earned, _activeClaims[account]);
    }

    // ------------------------------------------------------------------------
    // Internal
    // ------------------------------------------------------------------------

    function _getBounty(uint256 id) internal view returns (Bounty storage) {
        require(id < _bounties.length, "AgentBoard: bounty does not exist");
        return _bounties[id];
    }

    /// @notice Pay `amount` of `paymentToken` (or BNB when token is address(0))
    ///         to `to`. Reverts if the transfer fails.
    function _pay(address to, address paymentToken, uint256 amount) internal {
        if (paymentToken == address(0)) {
            (bool ok,) = to.call{value: amount}("");
            require(ok, "AgentBoard: BNB transfer failed");
        } else {
            require(IERC20(paymentToken).transfer(to, amount), "AgentBoard: ERC20 transfer failed");
        }
    }
}
