// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title CarbonOffsetPolkadot
 * @dev Carbon offset contract adapted for Polkadot's EVM environment
 * @notice This contract demonstrates carbon offsetting mechanism on Polkadot
 * Original implementation was designed for Flare Network with FDC integration
 */
contract CarbonOffsetPolkadot is Ownable {
    
    // Decimals for rate calculations
    // Example: If rate is in (tonnes_CO2 * 10^6) per gas_unit, RATE_DECIMALS = 6.
    uint256 constant RATE_DECIMALS = 6; 
    // USDT typically has 6 decimals.
    uint256 constant USDT_DECIMALS = 6; 

    // Mock oracle for demonstration - in production, this would be a proper oracle
    uint256 public carbonEmissionRate = 2500; // 0.0025 tonnes CO2 per gas unit (scaled by 10^6)
    uint256 public charUsdtRate = 50000000; // 50 USDT per tonne CO2 (scaled by 10^6)

    // Token addresses - to be set during deployment
    IERC20 public usdtToken;
    address public carbonCreditContract; // Contract that handles carbon credit purchases

    struct CarbonOffsetData {
        address recipientAddress; // Address that spent the gas
        uint256 recipientGas;     // Gas units spent
        uint256 rate;             // Scaled carbon emission rate
        uint256 timestamp;        // When the gas was consumed
        bytes32 txHash;           // Transaction hash for verification
    }

    struct OffsetRequest {
        address user;
        uint256 gasUsed;
        uint256 usdtAmount;
        uint256 carbonTonnes;
        uint256 timestamp;
        bool processed;
    }

    // Mapping to store offset requests
    mapping(bytes32 => OffsetRequest) public offsetRequests;
    mapping(address => uint256) public userTotalOffsets;

    // Events
    event CarbonOffsetCalculated(
        address indexed user,
        uint256 gasUsed,
        uint256 carbonTonnes,
        uint256 usdtRequired
    );
    
    event CarbonOffsetProcessed(
        bytes32 indexed requestId,
        address indexed user,
        uint256 usdtAmount,
        uint256 carbonTonnes
    );

    event EmissionRateUpdated(uint256 oldRate, uint256 newRate);
    event CharRateUpdated(uint256 oldRate, uint256 newRate);

    constructor(
        address _usdtTokenAddress,
        address _carbonCreditContract
    ) Ownable(msg.sender) {
        usdtToken = IERC20(_usdtTokenAddress);
        carbonCreditContract = _carbonCreditContract;
    }

    /**
     * @notice Calculates the amount of USDT needed for carbon offsetting
     * @param _recipientGas Gas units spent by the user
     * @param _rateFromProofData Scaled carbon emission rate
     * @param _charRateScaled Scaled CHAR-USDT rate
     * @return usdtAmount The amount of USDT needed for the offset
     */
    function getUsdtAmountForOffset(
        uint256 _recipientGas,
        uint256 _rateFromProofData, 
        uint256 _charRateScaled     
    ) public pure returns (uint256 usdtAmount) {
        // carbonTonnes_X_Precision = recipientGas * rateFromProofData
        uint256 carbonTonnesScaled = _recipientGas * _rateFromProofData;
        
        // usdtAmount = (carbonTonnesScaled * charRateScaled) / (10^RATE_DECIMALS)
        if (RATE_DECIMALS == 0) {
             return carbonTonnesScaled * _charRateScaled;
        }
        return (carbonTonnesScaled * _charRateScaled) / (10**RATE_DECIMALS);
    }

    /**
     * @notice Creates a carbon offset request based on gas usage
     * @param _gasUsed Amount of gas used in the transaction
     * @param _txHash Transaction hash for verification
     * @return requestId Unique identifier for the offset request
     */
    function createOffsetRequest(
        uint256 _gasUsed,
        bytes32 _txHash
    ) external returns (bytes32 requestId) {
        require(_gasUsed > 0, "Gas used must be greater than zero");
        
        // Calculate carbon offset requirements
        uint256 usdtRequired = getUsdtAmountForOffset(_gasUsed, carbonEmissionRate, charUsdtRate);
        uint256 carbonTonnes = (_gasUsed * carbonEmissionRate) / (10**RATE_DECIMALS);
        
        // Generate unique request ID
        requestId = keccak256(abi.encodePacked(msg.sender, _gasUsed, _txHash, block.timestamp));
        
        // Store the offset request
        offsetRequests[requestId] = OffsetRequest({
            user: msg.sender,
            gasUsed: _gasUsed,
            usdtAmount: usdtRequired,
            carbonTonnes: carbonTonnes,
            timestamp: block.timestamp,
            processed: false
        });

        emit CarbonOffsetCalculated(msg.sender, _gasUsed, carbonTonnes, usdtRequired);
        
        return requestId;
    }

    /**
     * @notice Processes a carbon offset request by transferring USDT and purchasing carbon credits
     * @param _requestId The unique identifier for the offset request
     */
    function processOffsetRequest(bytes32 _requestId) external {
        OffsetRequest storage request = offsetRequests[_requestId];
        
        require(request.user == msg.sender, "Only request creator can process");
        require(!request.processed, "Request already processed");
        require(request.usdtAmount > 0, "Invalid request");

        // Check user has enough USDT
        require(
            usdtToken.balanceOf(msg.sender) >= request.usdtAmount,
            "Insufficient USDT balance"
        );

        // Transfer USDT from user to this contract
        require(
            usdtToken.transferFrom(msg.sender, address(this), request.usdtAmount),
            "USDT transfer failed"
        );

        // Mark as processed
        request.processed = true;
        
        // Update user's total offsets
        userTotalOffsets[msg.sender] += request.carbonTonnes;

        // In a real implementation, this would interact with a carbon credit marketplace
        // For now, we'll approve the carbon credit contract to spend the USDT
        if (carbonCreditContract != address(0)) {
            usdtToken.approve(carbonCreditContract, request.usdtAmount);
            // Additional logic to call carbon credit contract would go here
        }

        emit CarbonOffsetProcessed(_requestId, msg.sender, request.usdtAmount, request.carbonTonnes);
    }

    /**
     * @notice Simplified carbon offset function that combines request creation and processing
     * @param _gasUsed Amount of gas used in the transaction  
     * @param _txHash Transaction hash for verification
     */
    function offsetCarbon(
        uint256 _gasUsed,
        bytes32 _txHash
    ) external {
        // Calculate offset requirements
        uint256 usdtRequired = getUsdtAmountForOffset(_gasUsed, carbonEmissionRate, charUsdtRate);
        uint256 carbonTonnes = (_gasUsed * carbonEmissionRate) / (10**RATE_DECIMALS);
        
        require(usdtRequired > 0, "Offset amount must be greater than zero");
        require(
            usdtToken.balanceOf(msg.sender) >= usdtRequired,
            "Insufficient USDT balance"
        );

        // Transfer USDT from user to this contract
        require(
            usdtToken.transferFrom(msg.sender, address(this), usdtRequired),
            "USDT transfer failed"
        );

        // Update user's total offsets
        userTotalOffsets[msg.sender] += carbonTonnes;

        // Process carbon credit purchase
        if (carbonCreditContract != address(0)) {
            usdtToken.approve(carbonCreditContract, usdtRequired);
            // Additional logic to call carbon credit contract would go here
        }

        // Generate request ID for tracking
        bytes32 requestId = keccak256(abi.encodePacked(msg.sender, _gasUsed, _txHash, block.timestamp));
        
        emit CarbonOffsetCalculated(msg.sender, _gasUsed, carbonTonnes, usdtRequired);
        emit CarbonOffsetProcessed(requestId, msg.sender, usdtRequired, carbonTonnes);
    }

    /**
     * @notice Batch carbon offset for multiple transactions
     * @param _gasUsedArray Array of gas amounts used
     * @param _txHashArray Array of transaction hashes
     */
    function batchOffsetCarbon(
        uint256[] calldata _gasUsedArray,
        bytes32[] calldata _txHashArray
    ) external {
        require(_gasUsedArray.length == _txHashArray.length, "Array length mismatch");
        require(_gasUsedArray.length > 0, "Empty arrays");

        uint256 totalUsdtRequired = 0;
        uint256 totalCarbonTonnes = 0;

        // Calculate total requirements
        for (uint256 i = 0; i < _gasUsedArray.length; i++) {
            uint256 usdtForThisTx = getUsdtAmountForOffset(_gasUsedArray[i], carbonEmissionRate, charUsdtRate);
            uint256 carbonForThisTx = (_gasUsedArray[i] * carbonEmissionRate) / (10**RATE_DECIMALS);
            
            totalUsdtRequired += usdtForThisTx;
            totalCarbonTonnes += carbonForThisTx;
        }

        require(totalUsdtRequired > 0, "Total offset amount must be greater than zero");
        require(
            usdtToken.balanceOf(msg.sender) >= totalUsdtRequired,
            "Insufficient USDT balance for batch offset"
        );

        // Transfer total USDT from user to this contract
        require(
            usdtToken.transferFrom(msg.sender, address(this), totalUsdtRequired),
            "USDT transfer failed"
        );

        // Update user's total offsets
        userTotalOffsets[msg.sender] += totalCarbonTonnes;

        // Process carbon credit purchase
        if (carbonCreditContract != address(0)) {
            usdtToken.approve(carbonCreditContract, totalUsdtRequired);
            // Additional logic to call carbon credit contract would go here
        }

        emit CarbonOffsetCalculated(msg.sender, _gasUsedArray.length, totalCarbonTonnes, totalUsdtRequired);
    }

    // Owner functions for updating rates
    function updateCarbonEmissionRate(uint256 _newRate) external onlyOwner {
        uint256 oldRate = carbonEmissionRate;
        carbonEmissionRate = _newRate;
        emit EmissionRateUpdated(oldRate, _newRate);
    }

    function updateCharUsdtRate(uint256 _newRate) external onlyOwner {
        uint256 oldRate = charUsdtRate;
        charUsdtRate = _newRate;
        emit CharRateUpdated(oldRate, _newRate);
    }

    function updateCarbonCreditContract(address _newContract) external onlyOwner {
        carbonCreditContract = _newContract;
    }

    function updateUsdtToken(address _newToken) external onlyOwner {
        usdtToken = IERC20(_newToken);
    }

    // View functions
    function getUserTotalOffsets(address _user) external view returns (uint256) {
        return userTotalOffsets[_user];
    }

    function getOffsetRequest(bytes32 _requestId) external view returns (OffsetRequest memory) {
        return offsetRequests[_requestId];
    }

    function getCurrentRates() external view returns (uint256 emissionRate, uint256 charRate) {
        return (carbonEmissionRate, charUsdtRate);
    }

    // Emergency functions
    function emergencyWithdrawUsdt(uint256 _amount) external onlyOwner {
        require(usdtToken.transfer(owner(), _amount), "Emergency withdrawal failed");
    }

    function emergencyWithdrawNative() external onlyOwner {
        payable(owner()).transfer(address(this).balance);
    }

    // Allow contract to receive native tokens
    receive() external payable {}
} 