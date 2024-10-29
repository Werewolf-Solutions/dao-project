// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

import "./WerewolfTokenV1.sol";

contract TokenSale is Ownable {
    //ERC20 public werewolfToken;
    WerewolfTokenV1 private werewolfToken;
    address public treasury;
    uint256 public price;
    uint256 public totalTokensForSale;
    uint256 public saleIdCounter;
    bool public saleActive;

    struct Sale {
        uint256 saleId;
        uint256 tokensAvailable;
        uint256 pricePerToken;
        bool active;
    }

    mapping(uint256 => Sale) public sales;

    event SaleStarted(
        uint256 saleId,
        uint256 tokensAvailable,
        uint256 pricePerToken
    );
    event SaleEnded(uint256 saleId);
    event TokensPurchased(
        address indexed buyer,
        uint256 amount,
        uint256 saleId
    );

    constructor(
        address _token,
        address _treasury,
        address _timelock
    ) Ownable(_timelock) {
        //werewolfToken = ERC20(_token);
        werewolfToken = WerewolfTokenV1(_token);
        treasury = _treasury;
        // Hard code first price
        price = 0.05 * 10 ** 18;
    }

    function startSale(uint256 _amount, uint256 _price) external onlyOwner {
        require(!saleActive, "Sale is already active");
        require(
            _amount > 0 && _price > 0,
            "Amount and price must be greater than zero"
        );
        require(
            werewolfToken.balanceOf(address(this)) >= _amount,
            "Not enough tokens for sale"
        );

        saleIdCounter++;
        sales[saleIdCounter] = Sale(saleIdCounter, _amount, _price, true);
        price = _price;
        totalTokensForSale = _amount;
        saleActive = true;

        emit SaleStarted(saleIdCounter, _amount, _price);
    }

    function buyTokens(uint256 _amount) external payable {
        require(saleActive, "Sale is not active");
        Sale storage currentSale = sales[saleIdCounter];
        require(
            currentSale.tokensAvailable >= _amount,
            "Not enough tokens available for sale"
        );
        require(
            msg.value == _amount * currentSale.pricePerToken,
            "Incorrect ETH amount sent"
        );

        uint256 tokenAmount = _amount * 10 ** werewolfToken.decimals();
        currentSale.tokensAvailable -= _amount;

        werewolfToken.transfer(msg.sender, tokenAmount);
        payable(treasury).transfer(msg.value);

        emit TokensPurchased(msg.sender, _amount, saleIdCounter);

        if (currentSale.tokensAvailable == 0) {
            _endSale();
        }
    }

    function _endSale() internal onlyOwner {
        require(saleActive, "Sale is not active");
        sales[saleIdCounter].active = false;
        saleActive = false;

        emit SaleEnded(saleIdCounter);
    }

    function endSale() external onlyOwner {
        _endSale();
    }
}
