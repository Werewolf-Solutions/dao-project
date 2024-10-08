import { expect } from "chai";
import hre from "hardhat";

describe("Token Contract", function () {
  let Token, DAO, Treasury, token, treasury, founder, addr1, addr2, dao;

  beforeEach(async function () {
    // Get the contract factories and signers
    Token = await hre.ethers.getContractFactory("Token");
    Treasury = await hre.ethers.getContractFactory("Treasury");
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

    // Airdrop tokens to founder, addr1, and addr2
    const airdropAmount = hre.ethers.utils.parseUnits("1000", 18);
    // await token.testMint(founder.address, airdropAmount);
    await token.testMint(addr1.address, airdropAmount);
    await token.testMint(addr2.address, airdropAmount);

    // Log balances
    console.log(
      "Founder balance:",
      hre.ethers.utils.formatUnits(await token.balanceOf(founder.address), 18)
    );
    console.log(
      "Addr1 balance:",
      hre.ethers.utils.formatUnits(await token.balanceOf(addr1.address), 18)
    );
    console.log(
      "Addr2 balance:",
      hre.ethers.utils.formatUnits(await token.balanceOf(addr2.address), 18)
    );
    console.log(
      "Treasury balance:",
      hre.ethers.utils.formatUnits(await token.balanceOf(treasury.address), 18)
    );
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
