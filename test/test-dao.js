import { expect } from "chai";
import hre from "hardhat";

describe("DAO Contract", function () {
  let WerewolfTokenV1,
    Treasury,
    TokenSale,
    Timelock,
    DAO,
    werewolfToken,
    tokenSale,
    treasury,
    timelock,
    dao,
    founder,
    addr1,
    addr2;

  const votingPeriod = 24 * 60 * 60 * 2; // 2 days

  beforeEach(async function () {
    // Get the contract factories and signers
    WerewolfTokenV1 = await hre.ethers.getContractFactory("WerewolfTokenV1");
    Treasury = await hre.ethers.getContractFactory("Treasury");
    DAO = await hre.ethers.getContractFactory("DAO");
    TokenSale = await hre.ethers.getContractFactory("TokenSale");
    Timelock = await hre.ethers.getContractFactory("Timelock");
    [founder, addr1, addr2] = await hre.ethers.getSigners();

    // Deploy the treasury contract first
    treasury = await Treasury.deploy(founder.address); // Deployer will be owner
    await treasury.deployed();

    // Deploy the werewolfToken contract with the Treasury address
    werewolfToken = await WerewolfTokenV1.deploy(
      treasury.address,
      founder.address,
      addr1.address
    );
    await werewolfToken.deployed();

    timelock = await Timelock.deploy(dao.address, votingPeriod);
    await timelock.deployed();

    // Deploy the DAO contract with WerewolfTokenV1 and Treasury addresses
    dao = await DAO.deploy(
      werewolfToken.address,
      treasury.address,
      timelock.address
    );
    await dao.deployed();

    // Deploy the werewolfToken sale contract with price 0.5 ETH per werewolfToken
    tokenSale = await TokenSale.deploy(
      werewolfToken.address,
      treasury.address,
      dao.address
    );
    await tokenSale.deployed();

    // Set the DAO as the owner of the WerewolfTokenV1 and Treasury
    await werewolfToken.transferOwnership(dao.address);
    await treasury.transferOwnership(dao.address);

    // console.log(`DAO address: ${dao.address}`);
    // console.log(`werewolfToken owner: ${await werewolfToken.owner()}`);
    // console.log(`werewolfToken sale owner: ${await tokenSale.owner()}`);
    // console.log(`treasury owner: ${await treasury.owner()}`);
  });

  it("should allow only the DAO to call airdrop through proposals", async function () {
    // Cost for the proposal
    const proposalCost = hre.ethers.utils.parseUnits("10", 18);

    // Airdrop amount
    const airdropAmount = hre.ethers.utils.parseUnits("100", 18);

    // Create a proposal to airdrop tokens from Treasury to addr1
    const functionParams = hre.ethers.utils.defaultAbiCoder.encode(
      ["address", "uint256"],
      [addr2.address, airdropAmount]
    );

    // Approve DAO to spend proposalCost tokens on behalf of founder
    await werewolfToken.connect(founder).approve(dao.address, proposalCost);

    await dao
      .connect(founder)
      .createProposal(
        [werewolfToken.address],
        ["airdrop(address,uint256)"],
        [functionParams]
      );

    // Simulate delay for voting period
    await simulateBlocks(votingPeriod);

    // WerewolfTokenV1 holders (founder, addr1) vote on the proposal
    await dao.connect(addr1).vote(0, true);
    await dao.connect(founder).vote(0, true);

    // Simulate the end of the voting period
    // await simulateBlocks(24 * 60 * 60);

    await dao.connect(founder).queueProposal(0);

    // Execute the proposals after voting
    await dao.connect(founder).executeProposal(0);

    const addr2Balance = await werewolfToken.balanceOf(addr2.address);

    // Check that the airdrop has been completed
    expect(addr2Balance.toString()).to.equal(airdropAmount.toString());
  });

  it("should allow the DAO to mint new tokens to Treasury", async function () {
    const mintAmount = hre.ethers.utils.parseUnits("1000", 18);

    // Prepare the function call data to mint tokens
    const mintProposalCallData = hre.ethers.utils.defaultAbiCoder.encode(
      ["uint256"],
      [mintAmount]
    );

    // Cost for the proposal
    const proposalCost = hre.ethers.utils.parseUnits("10", 18);

    // Approve DAO to spend proposalCost tokens on behalf of founder
    await werewolfToken.connect(founder).approve(dao.address, proposalCost);

    // Founder creates a proposal to mint tokens to the Treasury
    await dao
      .connect(founder)
      .createProposal(
        werewolfToken.address,
        "mint(uint256)",
        mintProposalCallData
      );

    // Simulate 1 day delay for voting period
    await simulateBlocks(24 * 60 * 60);

    // Cast votes from all participants
    await dao.connect(founder).vote(0, true);
    await dao.connect(addr1).vote(0, true);

    // Simulate the end of the voting period
    await simulateBlocks(24 * 60 * 60);

    // Record the initial Treasury balance before minting
    const initialTreasuryBalance = await werewolfToken.balanceOf(
      treasury.address
    );
    // console.log(
    //   "Treasury balance before proposal execution:",
    //   hre.ethers.utils.formatUnits(initialTreasuryBalance, 18)
    // );

    // Execute the proposal (if it directly calls callContractFunc, don't call it separately)
    await dao.executeProposal(0);

    // console.log(`Mint amount: ${hre.ethers.utils.formatUnits(mintAmount, 18)}`);
    // console.log(
    //   `Proposal cost: ${hre.ethers.utils.formatUnits(proposalCost, 18)}`
    // );

    // Check Treasury balance after proposal execution
    const treasuryBalance = await werewolfToken.balanceOf(treasury.address);
    // console.log(
    //   "Treasury balance after proposal execution:",
    //   hre.ethers.utils.formatUnits(treasuryBalance, 18)
    // );

    // console.log(
    //   `Total supply: ${hre.ethers.utils.formatUnits(
    //     await werewolfToken.totalSupply(),
    //     18
    //   )}`
    // );

    // Calculate the expected new Treasury balance
    const expectedTreasuryBalance = initialTreasuryBalance.add(mintAmount);
    // console.log(
    //   `Expected Treasury balance after minting: ${hre.ethers.utils.formatUnits(
    //     expectedTreasuryBalance,
    //     18
    //   )}`
    // );

    // Check that the Treasury balance matches the expected balance after proposal execution
    const newTreasuryBalance = await werewolfToken.balanceOf(treasury.address);
    // console.log(
    //   "Treasury balance after proposal execution:",
    //   hre.ethers.utils.formatUnits(newTreasuryBalance, 18)
    // );

    expect(newTreasuryBalance.toString()).to.equal(
      expectedTreasuryBalance.toString()
    );
  });

  it("should start WerewolfTokenV1 Sale when 'WerewolfTokenV1 Sale' proposal passes", async function () {
    // Log balances
    // console.log(
    //   "Founder balance:",
    //   hre.ethers.utils.formatUnits(await werewolfToken.balanceOf(founder.address), 18)
    // );
    // console.log(
    //   "Addr1 balance:",
    //   hre.ethers.utils.formatUnits(await werewolfToken.balanceOf(addr1.address), 18)
    // );
    // console.log(
    //   "Addr2 balance:",
    //   hre.ethers.utils.formatUnits(await werewolfToken.balanceOf(addr2.address), 18)
    // );
    // console.log(
    //   "Treasury balance:",
    //   hre.ethers.utils.formatUnits(await werewolfToken.balanceOf(treasury.address), 18)
    // );
    // console.log(
    //   "WerewolfTokenV1 sale balance:",
    //   hre.ethers.utils.formatUnits(await werewolfToken.balanceOf(tokenSale.address), 18)
    // );
    const saleTokenAmount = hre.ethers.utils.parseUnits("10000", 18);
    const saleTokenPrice = hre.ethers.utils.parseUnits("0.05", 18);

    // Cost for the proposal
    const proposalCost = hre.ethers.utils.parseUnits("10", 18);

    // Step 1: Encode and propose the transfer from Treasury to TokenSale
    const transferProposalCallData = hre.ethers.utils.defaultAbiCoder.encode(
      ["address", "uint256"],
      [tokenSale.address, saleTokenAmount]
    );

    // Approve DAO to spend proposalCost tokens on behalf of founder
    await werewolfToken.connect(founder).approve(dao.address, proposalCost);

    // Create a proposal for transferring tokens from Treasury to TokenSale
    await dao
      .connect(founder)
      .createProposal(
        werewolfToken.address,
        "airdrop(address,uint256)",
        transferProposalCallData
      );

    // Simulate 1 day delay for voting period
    await simulateBlocks(24 * 60 * 60);

    // Cast votes to approve the werewolfToken airdrop proposal
    await dao.connect(founder).vote(0, true);
    await dao.connect(addr1).vote(0, true);

    let proposalCount = await dao.proposalCount();

    // for (let i = 0; i < proposalCount; i++) {
    //   const proposal = await dao.proposals(i);
    //   const totalVotes =
    //     Number(proposal.votesFor) + Number(proposal.votesAgainst);
    //   console.log(`Proposal ${i}:`);
    //   console.log(`  Votes for: ${proposal.votesFor}`);
    //   console.log(`  Votes against: ${proposal.votesAgainst}`);
    //   console.log(`  Total votes: ${totalVotes}`);
    //   console.log(`  % votes for: ${(proposal.votesFor / totalVotes) * 100}`);
    // }

    // Simulate the end of the voting period
    await simulateBlocks(24 * 60 * 60);

    // Execute the transfer proposal
    await dao.executeProposal(0);

    // Log balances
    // console.log(
    //   "Founder balance:",
    //   hre.ethers.utils.formatUnits(await werewolfToken.balanceOf(founder.address), 18)
    // );
    // console.log(
    //   "Addr1 balance:",
    //   hre.ethers.utils.formatUnits(await werewolfToken.balanceOf(addr1.address), 18)
    // );
    // console.log(
    //   "Addr2 balance:",
    //   hre.ethers.utils.formatUnits(await werewolfToken.balanceOf(addr2.address), 18)
    // );
    // console.log(
    //   "Treasury balance:",
    //   hre.ethers.utils.formatUnits(await werewolfToken.balanceOf(treasury.address), 18)
    // );
    // console.log(
    //   "WerewolfTokenV1 sale balance:",
    //   hre.ethers.utils.formatUnits(await werewolfToken.balanceOf(tokenSale.address), 18)
    // );

    // Check that the TokenSale contract received the tokens
    const tokenSaleBalanceAfterTransfer = await werewolfToken.balanceOf(
      tokenSale.address
    );
    // console.log(
    //   "WerewolfTokenV1 Sale Balance After Transfer:",
    //   hre.ethers.utils.formatUnits(tokenSaleBalanceAfterTransfer, 18)
    // );

    // Step 2: Encode and propose starting the werewolfToken sale
    const saleProposalCallData = hre.ethers.utils.defaultAbiCoder.encode(
      ["uint256", "uint256"],
      [saleTokenAmount, saleTokenPrice]
    );

    // Approve DAO to spend proposalCost tokens on behalf of founder
    await werewolfToken.connect(founder).approve(dao.address, proposalCost);

    // Create a proposal to start the sale with 5,000 tokens at 0.5 ETH each
    await dao
      .connect(founder)
      .createProposal(
        tokenSale.address,
        "startSale(uint256,uint256)",
        saleProposalCallData
      );

    // Simulate 1 day delay for voting period
    await simulateBlocks(24 * 60 * 60);

    // console.log(await dao.proposals(1));

    // Cast votes to approve the sale proposal
    await dao.connect(founder).vote(1, true);
    await dao.connect(addr1).vote(1, true);
    // await dao.connect(addr2).vote(1, true);

    proposalCount = await dao.proposalCount();

    // for (let i = 0; i < proposalCount; i++) {
    //   const proposal = await dao.proposals(i);
    //   const totalVotes =
    //     Number(proposal.votesFor) + Number(proposal.votesAgainst);
    //   console.log(`Proposal ${i}:`);
    //   console.log(`  Votes for: ${proposal.votesFor}`);
    //   console.log(`  Votes against: ${proposal.votesAgainst}`);
    //   console.log(`  Total votes: ${totalVotes}`);
    //   console.log(`  % votes for: ${(proposal.votesFor / totalVotes) * 100}`);
    // }

    // Simulate the end of the voting period
    await simulateBlocks(24 * 60 * 60);

    // console.log(await dao.proposals(1));

    // Execute the sale proposal
    await dao.executeProposal(1);

    // Check the sale status and details
    const sale = await tokenSale.sales(1);
    // console.log(sale);
    expect(tokenSaleBalanceAfterTransfer.toString()).to.equal(
      saleTokenAmount.toString()
    );
    expect(sale.active).to.equal(true);
    expect(sale.tokensAvailable.toString()).to.equal(
      saleTokenAmount.toString()
    );
    expect(sale.pricePerToken.toString()).to.equal(saleTokenPrice.toString());
  });

  it("should not allow executing failed proposals", async function () {
    const mintAmount = hre.ethers.utils.parseUnits("5000", 18);

    // Encode the mint function proposal
    const mintProposalCallData = hre.ethers.utils.defaultAbiCoder.encode(
      ["address", "uint256"],
      [treasury.address, mintAmount]
    );

    // Create a proposal
    await dao
      .connect(addr1)
      .createProposal(
        werewolfToken.address,
        "mint(address,uint256)",
        mintProposalCallData
      );

    // Addr1 votes (without reaching majority)
    await werewolfToken.transfer(
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

// Simulate blocks
async function simulateBlocks(delay) {
  await hre.network.provider.send("evm_increaseTime", [delay]);
  await hre.network.provider.send("evm_mine");
}
