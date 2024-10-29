import { expect } from "chai";
import { logger } from "ethers";
import hre from "hardhat";

describe("Companies House Contract", function () {
  let WerewolfTokenV1,
    Treasury,
    TokenSale,
    Timelock,
    DAO,
    CompaniesHouse,
    werewolfToken,
    tokenSale,
    treasury,
    timelock,
    dao,
    companiesHouse,
    founder,
    addr1,
    addr2,
    addr3;

  const votingPeriod = 24 * 60 * 60 * 2; // 2 days

  beforeEach(async function () {
    // Get the contract factories and signers
    WerewolfTokenV1 = await hre.ethers.getContractFactory("WerewolfTokenV1");
    Treasury = await hre.ethers.getContractFactory("Treasury");
    DAO = await hre.ethers.getContractFactory("DAO");
    TokenSale = await hre.ethers.getContractFactory("TokenSale");
    Timelock = await hre.ethers.getContractFactory("Timelock");
    CompaniesHouse = await hre.ethers.getContractFactory("CompaniesHouseV1");
    [founder, addr1, addr2, addr3] = await hre.ethers.getSigners();

    // Deploy the treasury contract first
    treasury = await Treasury.deploy(founder.address); // Deployer will be owner
    await treasury.deployed();

    timelock = await Timelock.deploy(founder.address, votingPeriod);
    await timelock.deployed();

    // Deploy the werewolfToken contract with the Treasury address
    werewolfToken = await WerewolfTokenV1.deploy(
      treasury.address,
      timelock.address,
      founder.address,
      addr1.address
    );
    await werewolfToken.deployed();

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
      timelock.address
    );
    await tokenSale.deployed();

    // Deploy the CompaniesHouse contract with the Treasury and WerewolfToken addresses
    companiesHouse = await CompaniesHouse.deploy(
      werewolfToken.address,
      treasury.address,
      dao.address,
      tokenSale.address
    );
    await companiesHouse.deployed();

    // Set the DAO as the owner of the WerewolfTokenV1 and Treasury
    await werewolfToken.transferOwnership(timelock.address);
    await treasury.transferOwnership(timelock.address);

    // Cost for the proposal
    const proposalCost = hre.ethers.utils.parseUnits("10", 18);

    // Encode the function parameters for `setpendingAdmin()`
    const functionParamsAdmin = hre.ethers.utils.defaultAbiCoder.encode(
      ["address"],
      [dao.address]
    );

    // Approve the DAO to spend tokens for proposal cost, if required
    await werewolfToken.connect(founder).approve(dao.address, proposalCost);

    // Create the proposal through the DAO
    await timelock.connect(founder).queueTransaction(
      timelock.address, // Target contract
      "setPendingAdmin(address)", // Function signature
      functionParamsAdmin // Function arguments encoded
    );

    // Simulate delay for voting period
    await simulateBlocks(votingPeriod);

    await timelock.connect(founder).executeTransaction(
      timelock.address, // Target contract
      "setPendingAdmin(address)", // Function signature
      functionParamsAdmin // Function arguments encoded
    );

    await simulateBlocks(votingPeriod * 2);

    // Execute the proposals after voting
    await dao.connect(founder).__acceptAdmin();

    // Create and execute _authorizeCaller for CompaniesHouse in DAO and WerewolfToken contracts
    const functionParams = hre.ethers.utils.defaultAbiCoder.encode(
      ["address"],
      [companiesHouse.address]
    );

    // Approve DAO to spend proposalCost tokens on behalf of founder
    await werewolfToken.connect(founder).approve(dao.address, proposalCost);

    await dao
      .connect(founder)
      .createProposal(
        [dao.address, werewolfToken.address],
        ["_authorizeCaller(address)", "_authorizeCaller(address)"],
        [functionParams, functionParams]
      );

    // Simulate delay for voting period
    await simulateBlocks(votingPeriod);

    // WerewolfTokenV1 holders (founder, addr1) vote on the proposal
    await dao.connect(addr1).vote(0, true);
    await dao.connect(founder).vote(0, true);

    await simulateBlocks(votingPeriod * 2);

    // let proposalCount = await dao.proposalCount();

    // for (let i = 0; i < proposalCount; i++) {
    //   const proposal = await dao.proposals(i);
    //   const totalVotes =
    //     Number(proposal.votesFor) + Number(proposal.votesAgainst);
    //   console.log(`Proposal ${i}:`);
    //   console.log(`  Votes for: ${proposal.votesFor}`);
    //   console.log(`  Votes against: ${proposal.votesAgainst}`);
    //   console.log(`  Total votes: ${totalVotes}`);
    //   console.log(`  % votes for: ${(proposal.votesFor / totalVotes) * 100} %`);
    // }

    // Queue the proposal
    await dao.connect(founder).queueProposal(0);

    // Execute the proposals after voting
    await dao.connect(founder).executeProposal(0);
  });

  it("should create a company", async function () {
    const companyCost = hre.ethers.utils.parseUnits("10", 18);
    await werewolfToken
      .connect(founder)
      .approve(companiesHouse.address, companyCost);

    await companiesHouse
      .connect(founder)
      .createCompany(
        "Werewolf Solutions",
        "Software development",
        "https://werewolf.solutions",
        ["CEO", "CTO", "Founder", "CHR", "Developer"],
        ["CEO", "CTO", "Founder", "CHR"],
        "Lorenzo",
        "CEO",
        hre.ethers.utils.parseUnits("0.0007", 18),
        "WLF"
      );

    const company = await companiesHouse.retrieveCompany(0);

    expect(company.name).to.equal("Werewolf Solutions");
    expect(company.industry).to.equal("Software development");
  });

  it("should hire an employee", async function () {
    await createCompany();

    await companiesHouse.connect(founder).hireEmployee(
      addr1.address, // Employee wallet
      "Alice", // Name
      "Developer", // Role
      0, // Company ID
      hre.ethers.utils.parseUnits("0.0007", 18), // Salary
      "USD" // Currency
    );

    const employee = await companiesHouse.retrieveEmployee(0, addr1.address);

    expect(employee.name).to.equal("Alice");
    expect(employee.role).to.equal("Developer");
  });

  it("should set company role", async function () {
    await createCompany();

    await companiesHouse.connect(founder).hireEmployee(
      addr1.address, // Employee wallet
      "Alice", // Name
      "Developer", // Role
      0, // Company ID
      hre.ethers.utils.parseUnits("0.0007", 18), // Salary
      "USD" // Currency
    );

    await companiesHouse
      .connect(founder)
      .setCompanyRole(addr1.address, "CHR", 0);

    const employee = await companiesHouse.retrieveEmployee(0, addr1.address);
    expect(employee.role).to.equal("CHR");
  });

  it("should add company role", async function () {
    await createCompany();

    await companiesHouse.connect(founder).addCompanyRole(0, "DevOps");

    const company = await companiesHouse.retrieveCompany(0);
    expect(company.roles).to.include("DevOps");
  });

  it("should pay employees", async function () {
    // console.log(hre.ethers.utils.formatUnits(await tokenSale.price(), 18));

    const employeeSalary = hre.ethers.utils.parseUnits("0.0007", 18);
    await createCompany();

    // Hire addr3 as an employee with a salary of 1 token per second
    await companiesHouse.connect(founder).hireEmployee(
      addr3.address, // Employee wallet
      "Alice", // Name
      "Developer", // Role
      0, // Company ID
      employeeSalary, // Salary
      "USD" // Currency
    );

    // Hire addr2 as another employee with the same salary
    await companiesHouse.connect(founder).hireEmployee(
      addr2.address, // Employee wallet
      "Bob", // Name
      "SMM", // Role
      0, // Company ID
      employeeSalary, // Salary
      "USD" // Currency
    );

    const employeeBefore = await companiesHouse.retrieveEmployee(
      0,
      addr3.address
    );
    // console.log(employeeBefore);
    // console.log(await getBlockTimestamp());
    // console.log(employeeBefore.lastPayDate);
    // let payPeriod = (await getBlockTimestamp()) - employeeBefore.lastPayDate;
    // console.log(payPeriod);
    // let payAmount = payPeriod * employeeBefore.salary;
    // console.log(payAmount);

    // Simulate 10 seconds passing
    const testPeriod = 10;
    await simulateBlocks(testPeriod);

    const employeeAfter = await companiesHouse.retrieveEmployee(
      0,
      addr3.address
    );
    // console.log(employeeAfter);
    // console.log(await getBlockTimestamp());
    // console.log(employeeAfter.lastPayDate);
    // console.log(employeeAfter.salary);
    // let payPeriod = (await getBlockTimestamp()) - employeeAfter.lastPayDate;
    // console.log("Pay period: " + payPeriod);
    // let payAmount =
    //   (payPeriod * employeeAfter.salary) /
    //   hre.ethers.utils.formatUnits(await tokenSale.price(), 18);
    // console.log("Pay amount: " + payAmount);

    const employee1BalanceBefore = await werewolfToken.balanceOf(addr3.address);
    const employee2BalanceBefore = await werewolfToken.balanceOf(addr2.address);
    // console.log(employee1BalanceBefore);
    // console.log(employee2BalanceBefore);

    // Pay employees after 10 seconds of work
    await companiesHouse.connect(founder).payEmployees(0); // Pay all employees in company 0

    // Verify employee balances
    const employee1BalanceAfter = await werewolfToken.balanceOf(addr3.address);
    // console.log(employee1BalanceAfter);

    const employee2BalanceAfter = await werewolfToken.balanceOf(addr2.address);

    const employee1Balance = employee1BalanceAfter - employee1BalanceBefore;
    const employee2Balance = employee2BalanceAfter - employee2BalanceBefore;
    // console.log(employee1Balance);
    // console.log(employee2Balance);

    const expectedPayment =
      (employeeAfter.salary * testPeriod) /
      hre.ethers.utils.formatUnits(await tokenSale.price(), 18);

    expect(employee1Balance.toString()).to.equal(expectedPayment.toString());
    expect(employee2Balance.toString()).to.equal(expectedPayment.toString());
  });

  async function createCompany() {
    const companyCost = hre.ethers.utils.parseUnits("10", 18);
    await werewolfToken
      .connect(founder)
      .approve(companiesHouse.address, companyCost);

    await companiesHouse
      .connect(founder)
      .createCompany(
        "Werewolf Solutions",
        "Software development",
        "https://werewolf.solutions",
        ["CEO", "CTO", "Founder", "CHR", "SMM", "Developer"],
        ["CEO", "CTO", "Founder", "CHR"],
        "Lorenzo",
        "CEO",
        hre.ethers.utils.parseUnits("0.0007", 18),
        "WLF"
      );
  }

  // Simulate blocks by increasing time and mining new blocks
  async function simulateBlocks(delay) {
    await hre.network.provider.send("evm_increaseTime", [delay]);
    await hre.network.provider.send("evm_mine");
  }

  async function getBlockTimestamp() {
    // Get the latest block number
    const blockNumber = await hre.ethers.provider.getBlockNumber();

    // Get the block data using the block number
    const block = await hre.ethers.provider.getBlock(blockNumber);

    // Access the timestamp
    const timestamp = block.timestamp;
    return timestamp;
  }
});
