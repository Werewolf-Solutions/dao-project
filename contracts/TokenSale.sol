// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract TokenSale is Ownable {
    ERC20 public token;
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

    constructor(address _token, address _treasury, address _dao) Ownable(_dao) {
        token = ERC20(_token);
        treasury = _treasury;
    }

    function startSale(uint256 _amount, uint256 _price) external onlyOwner {
        require(!saleActive, "Sale is already active");
        require(
            _amount > 0 && _price > 0,
            "Amount and price must be greater than zero"
        );
        require(
            token.balanceOf(address(this)) >= _amount,
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

        uint256 tokenAmount = _amount * 10 ** token.decimals();
        currentSale.tokensAvailable -= _amount;

        token.transfer(msg.sender, tokenAmount);
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
}
