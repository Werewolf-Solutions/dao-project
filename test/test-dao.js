import { expect } from "chai";
import hre from "hardhat";

describe("DAO Contract", function () {
  let Token,
    Treasury,
    TokenSale,
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
    DAO = await hre.ethers.getContractFactory("DAO");
    TokenSale = await hre.ethers.getContractFactory("TokenSale");
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

    // Deploy the token sale contract with price 0.5 ETH per token
    tokenSale = await TokenSale.deploy(
      token.address,
      treasury.address,
      dao.address
    );
    await tokenSale.deployed();

    // Set the DAO as the owner of the Token and Treasury
    await token.transferOwnership(dao.address);
    await treasury.transferOwnership(dao.address);

    // Airdrop tokens to founder, addr1, and addr2
    const airdropAmount = hre.ethers.utils.parseUnits("1000", 18);
    await token.testMint(founder.address, airdropAmount);
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
    await token.connect(founder).approve(dao.address, proposalCost);

    // Founder creates a proposal to mint tokens to the Treasury
    await dao
      .connect(founder)
      .createProposal(token.address, "mint(uint256)", mintProposalCallData);

    // Simulate 1 day delay for voting period
    await hre.network.provider.send("evm_increaseTime", [24 * 60 * 60]);
    await hre.network.provider.send("evm_mine");

    // Cast votes from all participants
    await dao.connect(founder).vote(0);
    await dao.connect(addr1).vote(0);
    await dao.connect(addr2).vote(0);

    // Display proposal details
    // const proposalCount = await dao.proposalCount();
    // for (let i = 0; i < proposalCount; i++) {
    //   const proposal = await dao.proposals(i);
    //   const totalSupply = hre.ethers.utils.formatUnits(
    //     await token.totalSupply(),
    //     18
    //   );
    //   const treasuryBalance = hre.ethers.utils.formatUnits(
    //     await token.balanceOf(treasury.address),
    //     18
    //   );
    //   const circulatingSupply = totalSupply - treasuryBalance;
    //   console.log(`Proposal ${i}:`);
    //   console.log(`  Proposer: ${proposal.proposer}`);
    //   console.log(`  Target Contract: ${proposal.targetContract}`);
    //   console.log(
    //     `  Votes: ${hre.ethers.utils.formatUnits(proposal.votes, 18)}`
    //   );
    //   console.log(`  Token total supply: ${totalSupply}`);
    //   console.log(`  Treasury balance: ${treasuryBalance}`);
    //   console.log(`  Circulating supply: ${circulatingSupply}`);
    //   console.log(
    //     `  % votes: ${
    //       (hre.ethers.utils.formatUnits(proposal.votes, 18) /
    //         circulatingSupply) *
    //       100
    //     }`
    //   );
    //   console.log(`  Executed: ${proposal.executed}`);
    // }

    // Simulate the end of the voting period
    await hre.network.provider.send("evm_increaseTime", [24 * 60 * 60]);
    await hre.network.provider.send("evm_mine");

    // Record the initial Treasury balance before minting
    const initialTreasuryBalance = await token.balanceOf(treasury.address);

    // Execute the proposal (if it directly calls callContractFunc, don't call it separately)
    await dao.executeProposal(0);

    // console.log(`Mint amount: ${hre.ethers.utils.formatUnits(mintAmount, 18)}`);
    // console.log(
    //   `Proposal cost: ${hre.ethers.utils.formatUnits(proposalCost, 18)}`
    // );

    // Check Treasury balance after proposal execution
    const treasuryBalance = await token.balanceOf(treasury.address);
    // console.log(
    //   "Treasury balance after proposal execution:",
    //   hre.ethers.utils.formatUnits(treasuryBalance, 18)
    // );

    // console.log(
    //   `Total supply: ${hre.ethers.utils.formatUnits(
    //     await token.totalSupply(),
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
    const newTreasuryBalance = await token.balanceOf(treasury.address);
    // console.log(
    //   "Treasury balance after proposal execution:",
    //   hre.ethers.utils.formatUnits(newTreasuryBalance, 18)
    // );

    expect(newTreasuryBalance.toString()).to.equal(
      expectedTreasuryBalance.toString()
    );
  });

  it("should start Token Sale when 'Token Sale' proposal passes", async function () {
    const saleTokenAmount = hre.ethers.utils.parseUnits("5000", 18);
    const saleTokenPrice = hre.ethers.utils.parseUnits("0.5", 18);

    // Step 1: Encode and propose the transfer from Treasury to TokenSale
    const transferProposalCallData = hre.ethers.utils.defaultAbiCoder.encode(
      ["address", "uint256"],
      [tokenSale.address, saleTokenAmount]
    );

    // Cost for the proposal
    const proposalCost = hre.ethers.utils.parseUnits("10", 18);

    // Approve DAO to spend proposalCost tokens on behalf of founder
    await token.connect(founder).approve(dao.address, proposalCost);

    // Create a proposal for transferring tokens from Treasury to TokenSale
    await dao
      .connect(founder)
      .createProposal(
        treasury.address,
        "transfer(address,uint256)",
        transferProposalCallData
      );

    // Cast votes to approve the token transfer proposal
    await dao.connect(founder).vote(0);
    await dao.connect(addr1).vote(0);
    await dao.connect(addr2).vote(0);

    console.log(await dao.proposals(0));

    // Execute the transfer proposal
    await dao.executeProposal(0);

    console.log("Here");

    // Check that the TokenSale contract received the tokens
    const tokenSaleBalanceAfterTransfer = await token.balanceOf(
      tokenSale.address
    );
    console.log(
      "Token Sale Balance After Transfer:",
      tokenSaleBalanceAfterTransfer.toString()
    );
    expect(tokenSaleBalanceAfterTransfer.toString()).to.equal(
      saleTokenAmount.toString()
    );

    // Step 2: Encode and propose starting the token sale
    const saleProposalCallData = hre.ethers.utils.defaultAbiCoder.encode(
      ["uint256", "uint256"],
      [saleTokenAmount, saleTokenPrice]
    );

    // Approve DAO to spend proposalCost tokens on behalf of founder
    await token.connect(founder).approve(dao.address, proposalCost);

    // Create a proposal to start the sale with 5,000 tokens at 0.5 ETH each
    await dao
      .connect(founder)
      .createProposal(
        tokenSale.address,
        "startSale(uint256,uint256)",
        saleProposalCallData
      );

    // Cast votes to approve the sale proposal
    await dao.connect(founder).vote(1);
    await dao.connect(addr1).vote(1);
    await dao.connect(addr2).vote(1);

    // Execute the sale proposal
    await dao.executeProposal(1);

    // Check the sale status and details
    const sale = await tokenSale.sales(1);
    console.log(sale);
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
        token.address,
        "mint(address,uint256)",
        mintProposalCallData
      );

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
