// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "forge-std/Script.sol";
import "../contracts/AgentBoard.sol";

/// @notice Deploy script for AgentBoard on BNB Chain.
///
/// Usage (DO NOT run without the deployer wallet ready and funded):
///   BSC testnet:  forge script script/Deploy.s.sol --rpc-url bsc-testnet --broadcast
///   BSC mainnet:  forge script script/Deploy.s.sol --rpc-url bsc --broadcast
///
///   The deployer private key is supplied by forge at run time (e.g. via
///   --private-key or --account). This script never contains, reads, or
///   asks for any private key, seed phrase, or credential itself.
///
/// Agent ID contract addresses:
///   - BSC mainnet (chain 56): 0x60b9262456de011f7d15a54cdd8c48baaa8b022f
///     (SPACE ID Agent ID, verified on mainnet.)
///   - BSC testnet (chain 97): NOT VERIFIED. No official testnet deployment
///     of the Agent ID contract has been confirmed. TESTNET_AGENT_ID below is
///     deliberately left as address(0): deploying to testnet with this script
///     as-is REVERTS on purpose. Before any testnet deploy, verify whether
///     the Agent ID contract exists on BSC testnet (check BscScan testnet for
///     0x60b9262456de011f7d15a54cdd8c48baaa8b022f or an official testnet
///     address), and only then set TESTNET_AGENT_ID to that verified
///     address. NEVER deploy testnet with a guessed address: the board would
///     gate on the wrong contract and no real Agent ID holder could use it.
contract Deploy is Script {
    /// @notice SPACE ID Agent ID on BSC mainnet (chain 56), verified.
    address public constant MAINNET_AGENT_ID = 0x60B9262456dE011F7d15a54CdD8c48bAaa8B022F;

    /// @notice PLACEHOLDER. No verified Agent ID address on BSC testnet
    ///         (chain 97) yet. Set this to the verified testnet address
    ///         before deploying to testnet. Left as address(0) on purpose
    ///         so an unset deploy reverts instead of using a wrong address.
    address public constant TESTNET_AGENT_ID = address(0);

    function run() external {
        address agentId;
        if (block.chainid == 56) {
            agentId = MAINNET_AGENT_ID;
        } else if (block.chainid == 97) {
            require(
                TESTNET_AGENT_ID != address(0),
                "Deploy: TESTNET_AGENT_ID is not set; verify the Agent ID address on BSC testnet first"
            );
            agentId = TESTNET_AGENT_ID;
        } else {
            revert("Deploy: unsupported chain, only BSC mainnet (56) and BSC testnet (97)");
        }

        vm.broadcast();
        AgentBoard board = new AgentBoard(agentId);
        console.log("AgentBoard deployed at:", address(board));
        console.log("Agent ID contract:", agentId);
        console.log("Chain id:", block.chainid);
    }
}
