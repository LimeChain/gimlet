use solana_program::{
    msg,
    account_info::AccountInfo,
    entrypoint,
    entrypoint::ProgramResult,
    pubkey::Pubkey,
};

entrypoint!(process_instruction);

fn process_instruction(
    program_id: &Pubkey,
    accounts: &[AccountInfo],
    instruction_data: &[u8],
) -> ProgramResult {
    msg!("Hello, Solana!");
    Ok(())
}

fn main() {
    println!("Executable running");
}

// mount debugger on agave-ledger-tool and/or solana-lldb
#[test]
fn inline_test() {
   process_instruction(&Pubkey::default(), &[], &[]).unwrap();
}