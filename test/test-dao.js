import { expect } from "chai";
import hre from "hardhat";

describe("DAO Contract", function () {
  let Token, Treasury, DAO, token, treasury, dao, founder, addr1, addr2;

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
  });

  it("should allow the DAO to mint tokens to Treasury", async function () {
    const mintAmount = 1000;

    // Propose minting tokens to Treasury
    await dao.proposeMintToTreasury(mintAmount);

    // Check Treasury balance after minting
    const treasuryBalance = await token.balanceOf(treasury.address);
    expect(treasuryBalance.toString()).to.equal(
      hre.ethers.utils.parseUnits("1000", 18).toString()
    );
  });

  it("should allow creating proposals", async function () {
    const mintAmount = hre.ethers.utils.parseUnits("5000", 18);

    // Create a proposal
    await dao.connect(addr1).createProposal(mintAmount);

    const proposal = await dao.proposals(0);
    expect(proposal.amount.toString()).to.equal(mintAmount.toString());
    expect(proposal.proposer).to.equal(addr1.address);
  });

  it("should allow voting on proposals", async function () {
    const mintAmount = hre.ethers.utils.parseUnits("5000", 18);

    // Create a proposal
    await dao.connect(addr1).createProposal(mintAmount);

    // Transfer some tokens to addr1 and addr2 for voting
    await token.transfer(
      addr1.address,
      hre.ethers.utils.parseUnits("1000", 18)
    );
    await token.transfer(
      addr2.address,
      hre.ethers.utils.parseUnits("2000", 18)
    );

    // Addr1 and addr2 vote
    await dao.connect(addr1).vote(0);
    await dao.connect(addr2).vote(0);

    const proposal = await dao.proposals(0);
    expect(proposal.votes.toString()).to.equal(
      hre.ethers.utils.parseUnits("3000", 18).toString()
    ); // Total votes cast
  });

  it("should mint tokens to Treasury when 'Token Sale' proposal passes", async function () {
    const mintAmount = hre.ethers.utils.parseUnits("5000", 18);

    // Create a proposal to mint 5,000 tokens
    await dao.connect(addr1).createProposal(mintAmount);

    // Transfer tokens to addr1 and addr2 for voting
    await token.transfer(
      addr1.address,
      hre.ethers.utils.parseUnits("1000", 18)
    );
    await token.transfer(
      addr2.address,
      hre.ethers.utils.parseUnits("900000", 18)
    ); // More than 50% of total supply

    // Addr1 and addr2 vote on the proposal
    await dao.connect(addr1).vote(0);
    await dao.connect(addr2).vote(0);

    // Execute the proposal after votes are cast
    await dao.executeProposal(0);

    // Check the Treasury balance after minting 5,000 new tokens
    const treasuryBalance = await token.balanceOf(treasury.address);

    // Treasury's new balance should be 5,000 tokens
    expect(treasuryBalance.toString()).to.equal(mintAmount.toString());
  });

  it("should not allow executing failed proposals", async function () {
    const mintAmount = hre.ethers.utils.parseUnits("5000", 18);

    // Create a proposal
    await dao.connect(addr1).createProposal(mintAmount);

    // Addr1 votes (without reaching majority)
    await token.transfer(
      addr1.address,
      hre.ethers.utils.parseUnits("1000", 18)
    );
    await dao.connect(addr1).vote(0);

    // Try to execute the proposal without majority and catch the revert
    try {
      await dao.executeProposal(0);
      // If the above line doesn't throw, this will fail the test
      expect.fail("Execution should have reverted, but it didn't");
    } catch (error) {
      // Assert that the error message contains the revert reason
      expect(error.message).to.include("Proposal must be passed to execute");
    }
  });
});
