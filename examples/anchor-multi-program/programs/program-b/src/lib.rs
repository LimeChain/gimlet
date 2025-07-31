use anchor_lang::prelude::*;

declare_id!("iEZJUbLTzUMwYmfVH3EvAM2AXLPqqgT4xjM8em1LhnU");

#[program]
pub mod program_b {
    use super::*;

    pub fn initialize(ctx: Context<Initialize>) -> Result<()> {
        msg!("Program B ready!");
        Ok(())
    }

    pub fn multiply(ctx: Context<Multiply>, x: u32, y: u32) -> Result<()> {
        let result = x * y;
        msg!("Program B: {} * {} = {}", x, y, result);
        Ok(())
    }
}

#[derive(Accounts)]
pub struct Initialize {}

#[derive(Accounts)]
pub struct Multiply {}
