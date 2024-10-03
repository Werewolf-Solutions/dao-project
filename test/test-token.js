import { expect } from "chai";
import hre from "hardhat";

describe("Token Contract", function () {
  let Token, Treasury, token, treasury, owner, addr1, addr2, dao;

  beforeEach(async function () {
    // Get the contract factories and signers
    Token = await hre.ethers.getContractFactory("Token");
    Treasury = await hre.ethers.getContractFactory("Treasury");
    [owner, addr1, addr2] = await hre.ethers.getSigners();

    // Deploy the treasury contract
    treasury = await Treasury.deploy(owner.address); // DAO (owner) will be set later
    await treasury.deployed();

    // Deploy the token contract with Treasury address
    token = await Token.deploy(treasury.address);
    await token.deployed();

    // Simulate DAO being set
    await token.setDAO(owner.address); // owner as the DAO in this test case
  });

  it("should assign initial total supply to the Treasury", async function () {
    const treasuryBalance = await token.balanceOf(treasury.address);
    expect((await token.totalSupply()).toString()).to.equal(
      treasuryBalance.toString()
    );
  });

  it("should mint tokens to Treasury when DAO calls mint", async function () {
    const mintAmount = hre.ethers.utils.parseUnits("1000", 18); // 1000 tokens

    // Only the DAO (owner) can mint
    await token.connect(owner).mint(mintAmount);

    const treasuryBalance = await token.balanceOf(treasury.address);
    expect(treasuryBalance.toString()).to.equal(mintAmount.toString());
  });

  it("should not allow non-DAO addresses to mint tokens", async function () {
    const mintAmount = hre.ethers.utils.parseUnits("1000", 18);

    // Try to mint from a non-DAO account
    try {
      await token.connect(addr1).mint(addr1.address, mintAmount);
      expect.fail("Transaction should have reverted");
    } catch (error) {
      // Assert that the error message contains the revert reason
      expect(error.message).to.include("Only DAO can mint tokens");
    }
  });
});
