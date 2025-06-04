// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract MockCarbonCredit {
    mapping(address => uint256) public carbonCreditsOwned;
    uint256 public pricePerTonne = 50 * 10**6; // 50 USDT per tonne (6 decimals)
    
    IERC20 public usdtToken;
    
    event CarbonCreditsPurchased(address indexed buyer, uint256 tonnes, uint256 cost);
    event PriceUpdated(uint256 oldPrice, uint256 newPrice);
    
    constructor() {
        // USDT token address will be set after deployment
    }
    
    function setUsdtToken(address _usdtToken) external {
        require(address(usdtToken) == address(0), "USDT token already set");
        usdtToken = IERC20(_usdtToken);
    }
    
    function purchaseCredits(uint256 tonnes) external {
        require(tonnes > 0, "Tonnes must be greater than zero");
        uint256 cost = tonnes * pricePerTonne;
        
        if (address(usdtToken) != address(0)) {
            require(
                usdtToken.transferFrom(msg.sender, address(this), cost),
                "USDT transfer failed"
            );
        }
        
        carbonCreditsOwned[msg.sender] += tonnes;
        emit CarbonCreditsPurchased(msg.sender, tonnes, cost);
    }
    
    function purchaseCreditsWithApproval(uint256 tonnes, address buyer) external {
        require(tonnes > 0, "Tonnes must be greater than zero");
        uint256 cost = tonnes * pricePerTonne;
        
        if (address(usdtToken) != address(0)) {
            require(
                usdtToken.transferFrom(msg.sender, address(this), cost),
                "USDT transfer failed"
            );
        }
        
        carbonCreditsOwned[buyer] += tonnes;
        emit CarbonCreditsPurchased(buyer, tonnes, cost);
    }
    
    function getCreditsOwned(address owner) external view returns (uint256) {
        return carbonCreditsOwned[owner];
    }
    
    function setPricePerTonne(uint256 _newPrice) external {
        uint256 oldPrice = pricePerTonne;
        pricePerTonne = _newPrice;
        emit PriceUpdated(oldPrice, _newPrice);
    }
    
    // Emergency withdrawal function (for testing)
    function emergencyWithdraw() external {
        if (address(usdtToken) != address(0)) {
            uint256 balance = usdtToken.balanceOf(address(this));
            usdtToken.transfer(msg.sender, balance);
        }
    }
} 