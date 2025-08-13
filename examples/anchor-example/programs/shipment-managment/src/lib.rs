use anchor_lang::prelude::*;

declare_id!("6GYuei9hR62ZJgmSxFAxqp5xfyzYnH3ErTaPJ5J4zoYw");

#[program]
pub mod shipment_managment {
    use super::*;

    pub fn initialize_counter(ctx: Context<InitializeCounter>, initial_count: u64) -> Result<()> {
        let counter = &mut ctx.accounts.counter;
        counter.count = initial_count;
        counter.bump = ctx.bumps.counter;
        Ok(())
    }

    pub fn create_shipment(ctx: Context<CreateShipment>) -> Result<()> {
        let counter = &mut ctx.accounts.counter;
        let shipment = &mut ctx.accounts.shipment;

        shipment.creator = *ctx.accounts.creator.key;
        shipment.validated = false;
        shipment.approved = false;

        counter.count += 1;
        Ok(())
    }

    pub fn validate_shipment(ctx: Context<ValidateShipment>) -> Result<()> {
        ctx.accounts.shipment.validated = true;
        Ok(())
    }

    pub fn approve_shipment(ctx: Context<ApproveShipment>) -> Result<()> {
        require!(ctx.accounts.shipment.validated, ShipmentError::NotValidated);
        ctx.accounts.shipment.approved = true;
        Ok(())
    }
}

#[derive(Accounts)]
pub struct InitializeCounter<'info> {
    #[account(init, payer = authority, space = 8 + 8 + 1, seeds = [b"counter"], bump)]
    pub counter: Account<'info, Counter>,
    #[account(mut)]
    pub authority: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct CreateShipment<'info> {
    #[account(mut, seeds = [b"counter"], bump)]
    pub counter: Account<'info, Counter>,

    #[account(
        init,
        payer = creator,
        space = 8 + Shipment::SIZE,
        seeds = [b"shipment", counter.count.to_le_bytes().as_ref()],
        bump
    )]
    pub shipment: Account<'info, Shipment>,

    #[account(mut)]
    pub creator: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct ValidateShipment<'info> {
    #[account(mut)]
    pub shipment: Account<'info, Shipment>,
    pub validator: Signer<'info>, // optional validator logic
}

#[derive(Accounts)]
pub struct ApproveShipment<'info> {
    #[account(mut)]
    pub shipment: Account<'info, Shipment>,
    pub approver: Signer<'info>, // optional approver logic
}

#[account]
pub struct Counter {
    pub count: u64,
    pub bump: u8,
}

#[account]
pub struct Shipment {
    pub creator: Pubkey,
    pub validated: bool,
    pub approved: bool,
}

impl Shipment {
    pub const SIZE: usize = 32 + 1 + 1;
}

#[error_code]
pub enum ShipmentError {
    #[msg("Shipment must be validated before approval.")]
    NotValidated,
}