import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { ProgramA } from "../target/types/program_a";
import { ProgramB } from "../target/types/program_b";
import { ProgramC } from "../target/types/program_c";
import { generateInstruction } from "gimlet-instruction-gen";


describe("program a", () => {
  // Configure the client to use the local cluster.
  anchor.setProvider(anchor.AnchorProvider.env());

  const program_a = anchor.workspace.ProgramA as Program<ProgramA>;
  const program_b = anchor.workspace.ProgramB as Program<ProgramB>;
  const program_c = anchor.workspace.ProgramC as Program<ProgramC>;

  it("Is initialized!", async () => {
    // Add your test here.
    const ix = program_a.methods.initialize();
    const ix_data = (await ix.instruction()).data;
    const tx = await ix.rpc();

    generateInstruction(
      program_a.programId.toString(),
      "initialize",
      ix_data,
      [],
      "program-a"
    )
  });

  it("Adds two numbers", async () => {
    const a = 5;
    const b = 7;
    const ix = program_a.methods.add(a, b);
    const ix_data = (await ix.instruction()).data;
    const tx = await ix.rpc();
    console.log("Add tx signature", tx);


    generateInstruction(
      program_a.programId.toString(),
      "add",
      ix_data,
      [],
      "program-a"
    )
  });

  it("Counts down from a start value", async () => {
    const start = 5;
    const ix = program_a.methods.countDown(start);
    const ix_data = (await ix.instruction()).data;
    const tx = await ix.rpc();
    console.log("CountDown tx signature", tx);

    generateInstruction(
      program_a.programId.toString(),
      "countDown",
      ix_data,
      [],
      "program-a"
    )
  });

  it("Calculates power", async () => {
    const base = 2;
    const exp = 3;
    const ix = program_a.methods.calculatePower(base, exp);
    const ix_data = (await ix.instruction()).data;
    const tx = await ix.rpc();
    console.log("CalculatePower tx signature", tx);
    generateInstruction(
      program_a.programId.toString(),
      "calculatePower",
      ix_data,
      [],
      "program-a"
    );

  });

  it("initializes program B", async () => {
    const ix = program_b.methods.initialize();
    const ix_data = (await ix.instruction()).data;
    const tx = await ix.rpc();
    console.log("Program B initialized tx signature", tx);

    generateInstruction(
      program_b.programId.toString(),
      "initialize",
      ix_data,
      [],
      "program-b"
    );
  });

  it("Multiply two numbers in Program B", async () => {
    const a = 3;
    const b = 4;
    const ix = program_b.methods.multiply(a, b);
    const ix_data = (await ix.instruction()).data;
    const tx = await ix.rpc();
    console.log("Multiply tx signature", tx);

    generateInstruction(
      program_b.programId.toString(),
      "multiply",
      ix_data,
      [],
      "program-b"
    );
  });

  it("iniitializes program C", async () => {
    const ix = program_c.methods.initialize();
    const ix_data = (await ix.instruction()).data;
    const tx = await ix.rpc();
    console.log("Program C initialized tx signature", tx);

    generateInstruction(
      program_c.programId.toString(),
      "initialize",
      ix_data,
      [],
      "program-c"
    );
  });

  it("Subtract two numbers in Program C", async () => {
    const a = 10;
    const b = 4;
    const ix = program_c.methods.subtract(a, b);
    const ix_data = (await ix.instruction()).data;
    const tx = await ix.rpc();
    console.log("Subtract tx signature", tx);

    generateInstruction(
      program_c.programId.toString(),
      "subtract",
      ix_data,
      [],
      "program-c"
    );
  });
});
