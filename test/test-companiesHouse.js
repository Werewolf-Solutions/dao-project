import { expect } from "chai";
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
    addr2;

  const votingPeriod = 24 * 60 * 60 * 2; // 2 days

  beforeEach(async function () {
    // Get the contract factories and signers
    WerewolfTokenV1 = await hre.ethers.getContractFactory("WerewolfTokenV1");
    Treasury = await hre.ethers.getContractFactory("Treasury");
    DAO = await hre.ethers.getContractFactory("DAO");
    TokenSale = await hre.ethers.getContractFactory("TokenSale");
    Timelock = await hre.ethers.getContractFactory("Timelock");
    CompaniesHouse = await hre.ethers.getContractFactory("CompaniesHouseV1");
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

    // Deploy the CompaniesHouse contract with the Treasury and WerewolfToken addresses
    companiesHouse = await CompaniesHouse.deploy(
      werewolfToken.address,
      treasury.address
    );
    await companiesHouse.deployed();

    timelock = await Timelock.deploy(founder.address, votingPeriod);
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
    await timelock.transferOwnership(dao.address);
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
        ["CEO", "CTO", "Founder", "CHR"]
      );

    const companies = await companiesHouse.retrieveCompany(0);

    expect(companies.name).to.equal("Werewolf Solutions");
    expect(companies.industry).to.equal("Software development");
  });

  it("should hire an employee", async function () {
    await createCompany();

    await companiesHouse.connect(founder).hireEmployee(
      addr1.address, // Employee wallet
      "Alice", // Name
      "Developer", // Role
      0, // Company ID
      hre.ethers.utils.parseUnits("1", 18), // Salary
      "USD" // Currency
    );

    const employee = await companiesHouse.retrieveEmployee(0, addr1.address);
    console.log(employee);
    expect(employee.name).to.equal("Alice");
    expect(employee.role).to.equal("Developer");
  });

  it("should hire a contractor", async function () {
    await createCompany();

    await companiesHouse.connect(founder).hireContractor(
      addr1.address, // Contractor address
      "Bob", // Contractor name
      0, // Company ID
      hre.ethers.utils.parseUnits("2", 18), // Payment per task
      "ETH" // Currency
    );

    const contractor = await companiesHouse.retrieveEmployee(addr1.address);
    expect(contractor.name).to.equal("Bob");
    expect(contractor.role).to.equal("Contractor");
  });

  it("should set company role", async function () {
    await createCompany();

    await companiesHouse.connect(founder).hireEmployee(
      addr1.address, // Employee wallet
      "Alice", // Name
      "Developer", // Role
      0, // Company ID
      hre.ethers.utils.parseUnits("1", 18), // Salary
      "USD" // Currency
    );

    await companiesHouse
      .connect(founder)
      .setCompanyRole(addr1.address, "Manager");

    const employee = await companiesHouse.retrieveEmployee(addr1.address);
    expect(employee.role).to.equal("Manager");
  });

  it("should add company role", async function () {
    await createCompany();

    await companiesHouse.connect(founder).addCompanyRole(0, "DevOps");

    const company = await companiesHouse.retrieveCompany(0);
    expect(company.roles).to.include("DevOps");
  });

  it("should pay employees", async function () {
    await createCompany();

    // Hire addr1 as an employee with a salary of 1 token per second
    await companiesHouse.connect(founder).hireEmployee(
      addr1.address, // Employee wallet
      "Alice", // Name
      "Developer", // Role
      0, // Company ID
      employeeSalary, // Salary (1 token per second)
      "USD" // Currency
    );

    // Hire addr2 as another employee with the same salary
    await companiesHouse.connect(founder).hireEmployee(
      addr2.address, // Employee wallet
      "Bob", // Name
      "Designer", // Role
      0, // Company ID
      employeeSalary, // Salary (1 token per second)
      "USD" // Currency
    );

    // Treasury needs to have enough tokens to pay employees
    const treasuryBalance = hre.ethers.utils.parseUnits("10000", 18);
    await werewolfToken
      .connect(founder)
      .mint(treasury.address, treasuryBalance);

    // Simulate 10 seconds passing
    await simulateBlocks(10);

    // Pay employees after 10 seconds of work
    await companiesHouse.connect(founder).payEmployees(0); // Pay all employees in company 0

    // Verify employee balances
    const employee1Balance = await werewolfToken.balanceOf(addr1.address);
    const employee2Balance = await werewolfToken.balanceOf(addr2.address);

    const expectedPayment = hre.ethers.utils.parseUnits("10", 18); // 10 seconds * 1 token per second
    expect(employee1Balance).to.equal(expectedPayment);
    expect(employee2Balance).to.equal(expectedPayment);
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
        ["CEO", "CTO", "Founder", "CHR"]
      );
  }

  // Simulate blocks by increasing time and mining new blocks
  async function simulateBlocks(delay) {
    await hre.network.provider.send("evm_increaseTime", [delay]);
    await hre.network.provider.send("evm_mine");
  }
});
