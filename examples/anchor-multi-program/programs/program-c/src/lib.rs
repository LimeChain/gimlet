use anchor_lang::prelude::*;

declare_id!("G1iVfPqrUjjjLDRE27LEZmBUcBoDCZBSHWMNuAXQE7PM");

#[program]
pub mod program_c {
    use super::*;

    pub fn initialize(ctx: Context<Initialize>) -> Result<()> {
        msg!("Program C online!");
        Ok(())
    }

    pub fn subtract(ctx: Context<Subtract>, a: u32, b: u32) -> Result<()> {
        let result = a - b;
        msg!("Program C: {} - {} = {}", a, b, result);
        Ok(())
    }
}

#[derive(Accounts)]
pub struct Initialize {}

#[derive(Accounts)]
pub struct Subtract {}
