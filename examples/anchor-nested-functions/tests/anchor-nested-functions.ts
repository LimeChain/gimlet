import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { AnchorNestedFunctions } from "../target/types/anchor_nested_functions";
import { generateInstruction } from "gimlet-instruction-gen";


describe("anchor-nested-functions", () => {
  // Configure the client to use the local cluster.
  anchor.setProvider(anchor.AnchorProvider.env());

  const program = anchor.workspace.anchorNestedFunctions as Program<AnchorNestedFunctions>;
  const provider = anchor.getProvider();

  it("Is initialized!", async () => {
    // Add your test here.
    const ix = program.methods.initialize();

    // I am using this .instruction() to get the right instruction data (serialized form)
    const ix_data = (await ix.instruction()).data;
    const tx = await ix.rpc();

    generateInstruction(
      program.programId.toString(),
      "initialize",
      ix_data,
      [
        {key: provider.publicKey.toString(), is_signer: true, is_writable: true },
        {key: anchor.web3.SystemProgram.programId.toString(), is_signer: false, is_writable: false }
      ]
    )
    console.log("Your transaction signature", tx);
  });

  it("Test multiply!", async () => {
    // Add your test here.
    const ix = program.methods.multiply();

    const ix_data = (await ix.instruction()).data;
    const tx = await ix.rpc();

    generateInstruction(
      program.programId.toString(),
      "multiply",
      ix_data,
      [
        {key: provider.publicKey.toString(), is_signer: true, is_writable: true },
        {key: anchor.web3.SystemProgram.programId.toString(), is_signer: false, is_writable: false }
      ]
    )
    console.log("Your transaction signature", tx);
  });
});
