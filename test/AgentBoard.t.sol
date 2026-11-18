// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "forge-std/Test.sol";
import "../contracts/AgentBoard.sol";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

/// @notice Minimal stand-in for the real Agent ID contract.
///         balanceOf can be set per address. There is deliberately NO
///         tokenOfOwnerByIndex here, exactly like the real contract, which
///         does NOT implement ERC721Enumerable.
contract MockAgentID {
    mapping(address => uint256) private _balances;

    function setBalance(address account, uint256 amount) external {
        _balances[account] = amount;
    }

    function balanceOf(address account) external view returns (uint256) {
        return _balances[account];
    }
}

contract MockERC20 {
    string public name = "Mock USDC";
    string public symbol = "mUSDC";
    uint8 public decimals = 18;

    mapping(address => uint256) public balanceOf;
    mapping(address => mapping(address => uint256)) public allowance;

    function mint(address to, uint256 amount) external {
        balanceOf[to] += amount;
    }

    function approve(address spender, uint256 amount) external returns (bool) {
        allowance[msg.sender][spender] = amount;
        return true;
    }

    function transfer(address to, uint256 amount) external returns (bool) {
        if (balanceOf[msg.sender] < amount) return false;
        balanceOf[msg.sender] -= amount;
        balanceOf[to] += amount;
        return true;
    }

    function transferFrom(address from, address to, uint256 amount) external returns (bool) {
        if (balanceOf[from] < amount) return false;
        if (allowance[from][msg.sender] < amount) return false;
        allowance[from][msg.sender] -= amount;
        balanceOf[from] -= amount;
        balanceOf[to] += amount;
        return true;
    }
}

/// @notice Worker contract whose receive() tries to re-enter releasePayment
///         while the first releasePayment is still paying it out.
contract MaliciousWorker {
    AgentBoard public board;
    uint256 public targetId;

    constructor(AgentBoard board_) {
        board = board_;
    }

    function claimAndSubmit(uint256 id, string calldata proof) external {
        board.claimBounty(id);
        board.submitWork(id, proof);
    }

    function setTarget(uint256 id) external {
        targetId = id;
    }

    receive() external payable {
        // Re-entrancy attempt: ignored result, must fail inside the guard.
        (bool ok,) = address(board).call(abi.encodeWithSignature("releasePayment(uint256)", targetId));
        ok;
    }
}

/// @notice ERC20 whose transfer() tries to re-enter releasePayment while the
///         first releasePayment is still paying out through it.
contract MaliciousERC20 {
    mapping(address => uint256) public balanceOf;
    mapping(address => mapping(address => uint256)) public allowance;
    AgentBoard public board;
    uint256 public targetId;

    function setBoard(AgentBoard board_) external {
        board = board_;
    }

    function setTarget(uint256 id) external {
        targetId = id;
    }

    function mint(address to, uint256 amount) external {
        balanceOf[to] += amount;
    }

    function approve(address spender, uint256 amount) external returns (bool) {
        allowance[msg.sender][spender] = amount;
        return true;
    }

    function transfer(address to, uint256 amount) external returns (bool) {
        if (balanceOf[msg.sender] < amount) return false;
        balanceOf[msg.sender] -= amount;
        balanceOf[to] += amount;
        // Re-entrancy attempt: ignored result, must fail inside the guard.
        (bool ok,) = address(board).call(abi.encodeWithSignature("releasePayment(uint256)", targetId));
        ok;
        return true;
    }

    function transferFrom(address from, address to, uint256 amount) external returns (bool) {
        if (balanceOf[from] < amount) return false;
        if (allowance[from][msg.sender] < amount) return false;
        allowance[from][msg.sender] -= amount;
        balanceOf[from] -= amount;
        balanceOf[to] += amount;
        return true;
    }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

contract AgentBoardTest is Test {
    MockAgentID internal agentId;
    MockERC20 internal token;
    AgentBoard internal board;

    address internal poster = makeAddr("poster");
    address internal worker = makeAddr("worker");
    address internal worker2 = makeAddr("worker2");
    address internal stranger = makeAddr("stranger"); // holds no Agent ID

    uint256 internal constant BOUNTY_BNB = 0.01 ether;
    uint256 internal constant BOUNTY_TOKEN = 100 ether;

    function setUp() public {
        agentId = new MockAgentID();
        token = new MockERC20();
        board = new AgentBoard(address(agentId));

        agentId.setBalance(poster, 1);
        agentId.setBalance(worker, 1);
        agentId.setBalance(worker2, 1);

        vm.deal(poster, 100 ether);
        vm.deal(worker, 1 ether);
        vm.deal(worker2, 1 ether);
        vm.deal(stranger, 1 ether); // so value-bearing reverts come from the contract, not OutOfFunds

        token.mint(poster, 1_000_000 ether);
        vm.prank(poster);
        token.approve(address(board), type(uint256).max);
    }

    // -- helpers ------------------------------------------------------------

    function _createBNB() internal returns (uint256 id) {
        vm.prank(poster);
        id = board.createBounty{value: BOUNTY_BNB}(
            "Fix bug", "Fix the bug", address(0), BOUNTY_BNB, block.timestamp + 7 days
        );
    }

    function _createERC20() internal returns (uint256 id) {
        vm.prank(poster);
        id = board.createBounty("Write docs", "Write the docs", address(token), BOUNTY_TOKEN, block.timestamp + 7 days);
    }

    function _claimSubmit(uint256 id, address who) internal {
        vm.prank(who);
        board.claimBounty(id);
        vm.prank(who);
        board.submitWork(id, "ipfs://proof");
    }

    // -- createBounty -------------------------------------------------------

    function test_CreateBountyBNB() public {
        uint256 id = _createBNB();
        assertEq(board.bountyCount(), 1);
        AgentBoard.Bounty memory b = board.getBounty(id);
        assertEq(b.poster, poster);
        assertEq(b.worker, address(0));
        assertEq(b.paymentToken, address(0));
        assertEq(b.amount, BOUNTY_BNB);
        assertEq(uint256(b.status), uint256(AgentBoard.Status.Open));
        assertEq(address(board).balance, BOUNTY_BNB);
    }

    function test_CreateBountyERC20() public {
        uint256 id = _createERC20();
        assertEq(board.bountyCount(), 1);
        AgentBoard.Bounty memory b = board.getBounty(id);
        assertEq(b.paymentToken, address(token));
        assertEq(b.amount, BOUNTY_TOKEN);
        assertEq(token.balanceOf(address(board)), BOUNTY_TOKEN);
        assertEq(token.balanceOf(poster), 1_000_000 ether - BOUNTY_TOKEN);
    }

    function test_RevertCreate_NoAgentId() public {
        vm.prank(stranger);
        vm.expectRevert("AgentBoard: caller holds no Agent ID");
        board.createBounty{value: BOUNTY_BNB}("x", "x", address(0), BOUNTY_BNB, block.timestamp + 7 days);
    }

    function test_RevertCreate_ZeroAmount() public {
        vm.prank(poster);
        vm.expectRevert("AgentBoard: amount is zero");
        board.createBounty{value: 0}("x", "x", address(0), 0, block.timestamp + 7 days);
    }

    function test_RevertCreate_DeadlinePast() public {
        vm.prank(poster);
        vm.expectRevert("AgentBoard: deadline not in future");
        board.createBounty{value: BOUNTY_BNB}("x", "x", address(0), BOUNTY_BNB, block.timestamp - 1);
    }

    function test_RevertCreate_BNBValueMismatch() public {
        vm.prank(poster);
        vm.expectRevert("AgentBoard: BNB value must equal amount");
        board.createBounty{value: BOUNTY_BNB - 1}("x", "x", address(0), BOUNTY_BNB, block.timestamp + 7 days);

        vm.prank(poster);
        vm.expectRevert("AgentBoard: BNB value must equal amount");
        board.createBounty{value: BOUNTY_BNB + 1}("x", "x", address(0), BOUNTY_BNB, block.timestamp + 7 days);
        assertEq(board.bountyCount(), 0);
    }

    function test_RevertCreate_ERC20WithBNBValue() public {
        vm.prank(poster);
        vm.expectRevert("AgentBoard: do not send BNB with ERC20 bounty");
        board.createBounty{value: 0.01 ether}("x", "x", address(token), BOUNTY_TOKEN, block.timestamp + 7 days);
    }

    function test_RevertCreate_ERC20NoAllowance() public {
        address poorPoster = makeAddr("poorPoster");
        agentId.setBalance(poorPoster, 1);
        token.mint(poorPoster, BOUNTY_TOKEN);
        // No approve() call on purpose.
        vm.prank(poorPoster);
        vm.expectRevert("AgentBoard: ERC20 transferFrom failed");
        board.createBounty("x", "x", address(token), BOUNTY_TOKEN, block.timestamp + 7 days);
    }

    // -- claimBounty --------------------------------------------------------

    function test_ClaimBounty() public {
        uint256 id = _createBNB();
        vm.prank(worker);
        board.claimBounty(id);
        AgentBoard.Bounty memory b = board.getBounty(id);
        assertEq(b.worker, worker);
        assertEq(uint256(b.status), uint256(AgentBoard.Status.Claimed));
        assertEq(b.claimedAt, block.timestamp);
        (,, uint256 active) = board.agentStats(worker);
        assertEq(active, 1);
    }

    function test_RevertClaim_NoAgentId() public {
        uint256 id = _createBNB();
        vm.prank(stranger);
        vm.expectRevert("AgentBoard: caller holds no Agent ID");
        board.claimBounty(id);
    }

    function test_RevertClaim_PosterCannotClaim() public {
        uint256 id = _createBNB();
        vm.prank(poster);
        vm.expectRevert("AgentBoard: poster cannot claim own bounty");
        board.claimBounty(id);
    }

    function test_RevertClaim_DoubleClaim() public {
        uint256 id = _createBNB();
        vm.prank(worker);
        board.claimBounty(id);
        vm.prank(worker2);
        vm.expectRevert("AgentBoard: bounty not open");
        board.claimBounty(id);
    }

    function test_RevertClaim_AfterDeadline() public {
        uint256 id = _createBNB();
        vm.warp(block.timestamp + 7 days + 1);
        vm.prank(worker);
        vm.expectRevert("AgentBoard: deadline passed");
        board.claimBounty(id);
    }

    function test_RevertClaim_UnknownBounty() public {
        vm.prank(worker);
        vm.expectRevert("AgentBoard: bounty does not exist");
        board.claimBounty(999);
    }

    // -- submitWork ---------------------------------------------------------

    function test_SubmitWork() public {
        uint256 id = _createBNB();
        vm.prank(worker);
        board.claimBounty(id);
        vm.prank(worker);
        board.submitWork(id, "ipfs://proof-123");
        AgentBoard.Bounty memory b = board.getBounty(id);
        assertEq(uint256(b.status), uint256(AgentBoard.Status.Submitted));
        assertEq(b.proof, "ipfs://proof-123");
        assertEq(b.submittedAt, block.timestamp);
        (,, uint256 active) = board.agentStats(worker);
        assertEq(active, 0);
    }

    function test_RevertSubmit_NotWorker() public {
        uint256 id = _createBNB();
        vm.prank(worker);
        board.claimBounty(id);
        vm.prank(worker2);
        vm.expectRevert("AgentBoard: caller is not the worker");
        board.submitWork(id, "ipfs://proof");
    }

    function test_RevertSubmit_NotClaimed() public {
        uint256 id = _createBNB();
        vm.prank(worker);
        vm.expectRevert("AgentBoard: bounty not claimed");
        board.submitWork(id, "ipfs://proof");
    }

    // -- releasePayment -----------------------------------------------------

    function test_ReleasePaymentBNB() public {
        uint256 id = _createBNB();
        _claimSubmit(id, worker);
        uint256 before = worker.balance;
        vm.prank(poster);
        board.releasePayment(id);
        assertEq(worker.balance, before + BOUNTY_BNB);
        assertEq(address(board).balance, 0);
        AgentBoard.Bounty memory b = board.getBounty(id);
        assertEq(uint256(b.status), uint256(AgentBoard.Status.Completed));
        (uint256 completed, uint256 earned,) = board.agentStats(worker);
        assertEq(completed, 1);
        assertEq(earned, BOUNTY_BNB);
    }

    function test_ReleasePaymentERC20() public {
        uint256 id = _createERC20();
        _claimSubmit(id, worker);
        vm.prank(poster);
        board.releasePayment(id);
        assertEq(token.balanceOf(worker), BOUNTY_TOKEN);
        assertEq(token.balanceOf(address(board)), 0);
        (uint256 completed, uint256 earned,) = board.agentStats(worker);
        assertEq(completed, 1);
        assertEq(earned, BOUNTY_TOKEN);
    }

    function test_RevertRelease_NotPoster() public {
        uint256 id = _createBNB();
        _claimSubmit(id, worker);
        vm.prank(worker);
        vm.expectRevert("AgentBoard: caller is not the poster");
        board.releasePayment(id);
    }

    function test_RevertRelease_NotSubmitted() public {
        uint256 id = _createBNB();
        vm.prank(worker);
        board.claimBounty(id);
        vm.prank(poster);
        vm.expectRevert("AgentBoard: work not submitted");
        board.releasePayment(id);
    }

    // -- cancelBounty -------------------------------------------------------

    function test_CancelBounty_OpenRefund() public {
        uint256 id = _createBNB();
        uint256 before = poster.balance;
        vm.prank(poster);
        board.cancelBounty(id);
        assertEq(poster.balance, before + BOUNTY_BNB);
        assertEq(address(board).balance, 0);
        AgentBoard.Bounty memory b = board.getBounty(id);
        assertEq(uint256(b.status), uint256(AgentBoard.Status.Cancelled));
    }

    function test_CancelBounty_ERC20Refund() public {
        uint256 id = _createERC20();
        vm.prank(poster);
        board.cancelBounty(id);
        assertEq(token.balanceOf(poster), 1_000_000 ether);
        assertEq(token.balanceOf(address(board)), 0);
    }

    function test_RevertCancel_NotPoster() public {
        uint256 id = _createBNB();
        vm.prank(worker);
        vm.expectRevert("AgentBoard: caller is not the poster");
        board.cancelBounty(id);
    }

    function test_RevertCancel_NotOpen() public {
        uint256 id = _createBNB();
        vm.prank(worker);
        board.claimBounty(id);
        vm.prank(poster);
        vm.expectRevert("AgentBoard: bounty not open");
        board.cancelBounty(id);
    }

    // -- refundExpired ------------------------------------------------------

    function test_RefundExpired() public {
        uint256 id = _createBNB();
        vm.prank(worker);
        board.claimBounty(id);
        vm.warp(block.timestamp + 7 days + 1);
        uint256 before = poster.balance;
        // Anyone may call it, even an address with no Agent ID.
        vm.prank(stranger);
        board.refundExpired(id);
        assertEq(poster.balance, before + BOUNTY_BNB);
        assertEq(address(board).balance, 0);
        AgentBoard.Bounty memory b = board.getBounty(id);
        assertEq(uint256(b.status), uint256(AgentBoard.Status.Expired));
        (,, uint256 active) = board.agentStats(worker);
        assertEq(active, 0);
    }

    function test_RevertRefundExpired_NotClaimed() public {
        uint256 id = _createBNB();
        vm.warp(block.timestamp + 7 days + 1);
        vm.prank(stranger);
        vm.expectRevert("AgentBoard: bounty not claimed");
        board.refundExpired(id);
    }

    function test_RevertRefundExpired_BeforeDeadline() public {
        uint256 id = _createBNB();
        vm.prank(worker);
        board.claimBounty(id);
        vm.prank(stranger);
        vm.expectRevert("AgentBoard: deadline not passed");
        board.refundExpired(id);
    }

    // -- claimTimeout -------------------------------------------------------

    function test_RevertClaimTimeout_Before3Days() public {
        uint256 id = _createBNB();
        _claimSubmit(id, worker);
        // Exactly 3 days after submit: still too early (strictly greater).
        vm.warp(block.timestamp + 3 days);
        vm.prank(worker);
        vm.expectRevert("AgentBoard: timeout not reached");
        board.claimTimeout(id);
    }

    function test_ClaimTimeout_After3Days() public {
        uint256 id = _createBNB();
        _claimSubmit(id, worker);
        vm.warp(block.timestamp + 3 days + 1);
        uint256 before = worker.balance;
        vm.prank(worker);
        board.claimTimeout(id);
        assertEq(worker.balance, before + BOUNTY_BNB);
        assertEq(address(board).balance, 0);
        AgentBoard.Bounty memory b = board.getBounty(id);
        assertEq(uint256(b.status), uint256(AgentBoard.Status.Completed));
        (uint256 completed, uint256 earned,) = board.agentStats(worker);
        assertEq(completed, 1);
        assertEq(earned, BOUNTY_BNB);
    }

    function test_RevertClaimTimeout_NotWorker() public {
        uint256 id = _createBNB();
        _claimSubmit(id, worker);
        vm.warp(block.timestamp + 3 days + 1);
        vm.prank(worker2);
        vm.expectRevert("AgentBoard: caller is not the worker");
        board.claimTimeout(id);
    }

    function test_RevertClaimTimeout_NotSubmitted() public {
        uint256 id = _createBNB();
        vm.prank(worker);
        board.claimBounty(id);
        vm.warp(block.timestamp + 3 days + 1);
        vm.prank(worker);
        vm.expectRevert("AgentBoard: work not submitted");
        board.claimTimeout(id);
    }

    // -- reentrancy ---------------------------------------------------------

    function test_Reentrancy_ReleasePayment_BNB() public {
        MaliciousWorker attacker = new MaliciousWorker(board);
        agentId.setBalance(address(attacker), 1);
        uint256 id = _createBNB();
        attacker.claimAndSubmit(id, "ipfs://proof");
        attacker.setTarget(id);
        uint256 before = address(attacker).balance;
        vm.prank(poster);
        board.releasePayment(id);
        // Paid exactly once despite the re-entrancy attempt in receive().
        assertEq(address(attacker).balance, before + BOUNTY_BNB);
        assertEq(address(board).balance, 0);
        AgentBoard.Bounty memory b = board.getBounty(id);
        assertEq(uint256(b.status), uint256(AgentBoard.Status.Completed));
        (uint256 completed, uint256 earned,) = board.agentStats(address(attacker));
        assertEq(completed, 1);
        assertEq(earned, BOUNTY_BNB);
    }

    function test_Reentrancy_ReleasePayment_ERC20() public {
        MaliciousERC20 evil = new MaliciousERC20();
        evil.setBoard(board);
        evil.mint(poster, 1_000_000 ether);
        vm.prank(poster);
        evil.approve(address(board), type(uint256).max);
        vm.prank(poster);
        uint256 id =
            board.createBounty("Evil", "Evil token bounty", address(evil), BOUNTY_TOKEN, block.timestamp + 7 days);
        evil.setTarget(id);
        _claimSubmit(id, worker);
        vm.prank(poster);
        board.releasePayment(id);
        // Paid exactly once despite the re-entrancy attempt in transfer().
        assertEq(evil.balanceOf(worker), BOUNTY_TOKEN);
        assertEq(evil.balanceOf(address(board)), 0);
        (uint256 completed, uint256 earned,) = board.agentStats(worker);
        assertEq(completed, 1);
        assertEq(earned, BOUNTY_TOKEN);
    }

    // -- views --------------------------------------------------------------

    function test_ViewFunctions() public {
        assertEq(board.bountyCount(), 0);
        assertTrue(board.hasAgentId(poster));
        assertTrue(board.hasAgentId(worker));
        assertFalse(board.hasAgentId(stranger));
        assertEq(board.agentId(), address(agentId));
        assertEq(board.CLAIM_TIMEOUT(), 3 days);

        uint256 id = _createBNB();
        assertEq(board.bountyCount(), 1);
        (uint256 c0, uint256 e0, uint256 a0) = board.agentStats(worker);
        assertEq(c0, 0);
        assertEq(e0, 0);
        assertEq(a0, 0);

        vm.prank(worker);
        board.claimBounty(id);
        (,, uint256 a1) = board.agentStats(worker);
        assertEq(a1, 1);

        AgentBoard.Bounty memory b = board.getBounty(id);
        assertEq(b.title, "Fix bug");
        assertEq(b.description, "Fix the bug");
        assertEq(b.deadline, block.timestamp + 7 days);
    }

    function test_RevertGetBounty_Unknown() public {
        vm.expectRevert("AgentBoard: bounty does not exist");
        board.getBounty(0);
    }
}
