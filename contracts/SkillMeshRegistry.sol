// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

contract SkillMeshRegistry {
    struct AgentProfile {
        address wallet;
        string role;
        string skill;
        string metadataURI;
        uint256 completedTasks;
        bool exists;
    }

    struct CompletionRecord {
        bytes32 taskHash;
        address orchestrator;
        uint256 totalPaid;
        uint256 timestamp;
    }

    event AgentRegistered(address indexed wallet, string role, string skill, string metadataURI);
    event TaskCompleted(
        bytes32 indexed taskHash,
        address indexed orchestrator,
        address[] participants,
        uint256[] payouts,
        uint256 totalPaid
    );

    mapping(address => AgentProfile) public agents;
    mapping(bytes32 => CompletionRecord) public completions;
    address[] private agentIndex;

    function registerAgent(
        string calldata role,
        string calldata skill,
        string calldata metadataURI
    ) external {
        AgentProfile storage profile = agents[msg.sender];

        if (!profile.exists) {
            agentIndex.push(msg.sender);
            profile.wallet = msg.sender;
            profile.exists = true;
        }

        profile.role = role;
        profile.skill = skill;
        profile.metadataURI = metadataURI;

        emit AgentRegistered(msg.sender, role, skill, metadataURI);
    }

    function recordTaskCompletion(
        bytes32 taskHash,
        address orchestrator,
        address[] calldata participants,
        uint256[] calldata payouts
    ) external {
        require(participants.length == payouts.length, "length mismatch");
        require(completions[taskHash].timestamp == 0, "task exists");

        uint256 totalPaid = 0;
        for (uint256 index = 0; index < participants.length; index++) {
            totalPaid += payouts[index];
            if (agents[participants[index]].exists) {
                agents[participants[index]].completedTasks += 1;
            }
        }

        completions[taskHash] = CompletionRecord({
            taskHash: taskHash,
            orchestrator: orchestrator,
            totalPaid: totalPaid,
            timestamp: block.timestamp
        });

        emit TaskCompleted(taskHash, orchestrator, participants, payouts, totalPaid);
    }

    function getAgents() external view returns (AgentProfile[] memory profiles) {
        profiles = new AgentProfile[](agentIndex.length);

        for (uint256 index = 0; index < agentIndex.length; index++) {
            profiles[index] = agents[agentIndex[index]];
        }
    }

    function getAgentsBySkill(
        string calldata skill
    ) external view returns (AgentProfile[] memory matches) {
        uint256 count = 0;

        for (uint256 index = 0; index < agentIndex.length; index++) {
            if (_equals(agents[agentIndex[index]].skill, skill)) {
                count++;
            }
        }

        matches = new AgentProfile[](count);
        uint256 cursor = 0;

        for (uint256 index = 0; index < agentIndex.length; index++) {
            AgentProfile memory profile = agents[agentIndex[index]];
            if (_equals(profile.skill, skill)) {
                matches[cursor] = profile;
                cursor++;
            }
        }
    }

    function getAgentReputation(address wallet) external view returns (uint256) {
        return agents[wallet].completedTasks;
    }

    function _equals(string memory left, string memory right) internal pure returns (bool) {
        return keccak256(bytes(left)) == keccak256(bytes(right));
    }
}
