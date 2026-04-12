// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @notice Lightweight receipt token for the local prototype.
/// Replace with an audited ERC-721 implementation before production deployment.
contract SkillMeshReceipt {
    string public constant name = "SkillMesh Receipt";
    string public constant symbol = "SMR";

    uint256 public nextTokenId = 1;

    mapping(uint256 => address) public ownerOf;
    mapping(address => uint256) public balanceOf;
    mapping(uint256 => string) private tokenURIs;

    event Transfer(address indexed from, address indexed to, uint256 indexed tokenId);

    function mintReceipt(address to, string calldata tokenURI_) external returns (uint256 tokenId) {
        require(to != address(0), "zero address");

        tokenId = nextTokenId;
        nextTokenId += 1;

        ownerOf[tokenId] = to;
        balanceOf[to] += 1;
        tokenURIs[tokenId] = tokenURI_;

        emit Transfer(address(0), to, tokenId);
    }

    function tokenURI(uint256 tokenId) external view returns (string memory) {
        require(ownerOf[tokenId] != address(0), "missing token");
        return tokenURIs[tokenId];
    }
}
