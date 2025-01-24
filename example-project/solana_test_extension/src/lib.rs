use solana_program::{
    account_info::AccountInfo, entrypoint, entrypoint::ProgramResult, msg, pubkey::Pubkey,
};

entrypoint!(process_instruction);

pub fn process_instruction(
    program_id: &Pubkey,
    accounts: &[AccountInfo],
    instruction_data: &[u8],
) -> ProgramResult {
    let stop = 1;
    msg!("stop: {}", stop);
    msg!("lorem ipsum");
    msg!("Hello, Solana!");
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_process_instruction() {
        let result = process_instruction(&Pubkey::default(), &[], &[]);
        assert!(result.is_ok());
    }
}
