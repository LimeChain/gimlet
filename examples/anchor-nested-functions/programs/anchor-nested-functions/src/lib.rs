use crate::instructions::*;
use anchor_lang::prelude::*;

pub mod instructions;

declare_id!("2rc2qFi3LrceQa5snksLzxdHAQsShVBRoFhztMvYu4UJ");

#[program]
pub mod anchor_nested_functions {
    use super::*;

    pub fn initialize(ctx: Context<Initialize>) -> Result<()> {
        _initialize(ctx)
    }

    pub fn multiply(ctx: Context<Multiply>) -> Result<()> {
        _multiply(ctx)
    }
}