import { expect } from "chai";
import hre from "hardhat";

describe("Token Sale Contract", function () {
  let Token,
    TokenSale,
    Treasury,
    DAO,
    token,
    tokenSale,
    treasury,
    dao,
    founder,
    addr1,
    addr2;

  beforeEach(async function () {
    // Get the contract factories and signers
    Token = await hre.ethers.getContractFactory("Token");
    Treasury = await hre.ethers.getContractFactory("Treasury");
    TokenSale = await hre.ethers.getContractFactory("TokenSale");
    DAO = await hre.ethers.getContractFactory("DAO");
    [founder, addr1, addr2] = await hre.ethers.getSigners();

    // Deploy the treasury contract first
    treasury = await Treasury.deploy(founder.address); // Deployer will be owner
    await treasury.deployed();

    // Deploy the token contract with the Treasury address
    token = await Token.deploy(treasury.address);
    await token.deployed();

    // Deploy the DAO contract with Token and Treasury addresses
    dao = await DAO.deploy(token.address, treasury.address);
    await dao.deployed();

    // Set the DAO as the owner of the Token and Treasury
    await token.transferOwnership(dao.address);
    await treasury.transferOwnership(dao.address);

    // Deploy the token sale contract with price 0.5 ETH per token
    tokenSale = await TokenSale.deploy(
      token.address,
      treasury.address,
      dao.address
    );
    await tokenSale.deployed();

    // Transfer some tokens to the sale contract
    await token.testMint(
      tokenSale.address,
      hre.ethers.utils.parseUnits("100000", 18)
    );
  });

  it("should allow users to purchase tokens", async function () {
    const amountToBuy = 10; // Buy 10 tokens
    const valueSent = hre.ethers.utils.parseEther("5"); // 0.5 ETH per token * 10 tokens

    // addr1 buys 10 tokens
    await tokenSale
      .connect(addr1)
      .buyTokens(amountToBuy, { value: valueSent, gasLimit: 3000000 });

    const addr1Balance = await token.balanceOf(addr1.address);
    expect(addr1Balance.toString()).to.equal(
      hre.ethers.utils.parseUnits("10", 18).toString()
    );
  });

  it("should revert if incorrect ETH value is sent", async function () {
    const amountToBuy = 10;

    // Try to buy with incorrect ETH (too low)
    try {
      await tokenSale
        .connect(addr1)
        .buyTokens(amountToBuy, { value: hre.ethers.utils.parseEther("4") });
      // If no error is thrown, we force the test to fail
      expect.fail("Transaction should have reverted");
    } catch (error) {
      // Assert that the error message contains the revert reason
      expect(error.message).to.include("Incorrect amount of ETH");
    }
  });

  it("should transfer ETH to the Treasury after purchase", async function () {
    const amountToBuy = 10;
    const valueSent = hre.ethers.utils.parseEther("5");

    const treasuryBalanceBefore = await hre.ethers.provider.getBalance(
      treasury.address
    );

    // addr1 buys tokens
    await tokenSale
      .connect(addr1)
      .buyTokens(amountToBuy, { value: valueSent, gasLimit: 3000000 });

    // Check that Treasury received the ETH
    const treasuryBalanceAfter = await hre.ethers.provider.getBalance(
      treasury.address
    );
    expect(treasuryBalanceAfter.sub(treasuryBalanceBefore).toString()).to.equal(
      hre.ethers.utils.parseEther("5").toString()
    );
  });
});
