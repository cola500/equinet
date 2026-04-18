import { describe, it, expect } from 'vitest'
import * as fs from 'fs'
import * as path from 'path'

const MIGRATION_DIR = '20260418200000_conversation_rls_policies'
const MIGRATION_PATH = path.resolve(
  __dirname,
  '..',
  '..',
  '..',
  'prisma',
  'migrations',
  MIGRATION_DIR,
  'migration.sql'
)

describe('Conversation RLS migration', () => {
  let sql: string

  it('migration file exists', () => {
    expect(fs.existsSync(MIGRATION_PATH)).toBe(true)
    sql = fs.readFileSync(MIGRATION_PATH, 'utf-8')
  })

  describe('ENABLE ROW LEVEL SECURITY', () => {
    it('enables RLS on Conversation table', () => {
      const s = fs.readFileSync(MIGRATION_PATH, 'utf-8')
      expect(s).toContain('ALTER TABLE public."Conversation" ENABLE ROW LEVEL SECURITY')
    })

    it('enables RLS on Message table', () => {
      const s = fs.readFileSync(MIGRATION_PATH, 'utf-8')
      expect(s).toContain('ALTER TABLE public."Message" ENABLE ROW LEVEL SECURITY')
    })
  })

  describe('Conversation READ policies (booking-mediated, no conversationId shortcut)', () => {
    it('customer read policy joins Booking to verify ownership', () => {
      const s = fs.readFileSync(MIGRATION_PATH, 'utf-8')
      expect(s).toContain('conversation_customer_read')
      expect(s).toContain('FOR SELECT')
      // Must go via Booking, not conversationId alone
      expect(s).toMatch(/FROM public\."Booking" b[\s\S]*"Conversation"\."bookingId"/)
      expect(s).toContain('auth.uid()::text')
    })

    it('provider read policy uses rls_provider_id() and joins Booking', () => {
      const s = fs.readFileSync(MIGRATION_PATH, 'utf-8')
      expect(s).toContain('conversation_provider_read')
      expect(s).toMatch(/FROM public\."Booking" b[\s\S]*"Conversation"\."bookingId"/)
      expect(s).toContain('rls_provider_id()')
    })
  })

  describe('Message READ policies (Conversation → Booking join, no shortcut)', () => {
    it('customer read policy joins Conversation then Booking', () => {
      const s = fs.readFileSync(MIGRATION_PATH, 'utf-8')
      expect(s).toContain('message_customer_read')
      // Ensures Message is accessed via Conversation → Booking ownership, not conversationId alone
      expect(s).toMatch(/FROM public\."Conversation" c[\s\S]*JOIN public\."Booking" b/)
      expect(s).toContain('auth.uid()::text')
    })

    it('provider read policy joins Conversation then Booking', () => {
      const s = fs.readFileSync(MIGRATION_PATH, 'utf-8')
      expect(s).toContain('message_provider_read')
      expect(s).toMatch(/FROM public\."Conversation" c[\s\S]*JOIN public\."Booking" b/)
      expect(s).toContain('rls_provider_id()')
    })
  })

  describe('Message INSERT policies with sender identity check', () => {
    it('customer insert policy verifies senderType=CUSTOMER and senderId=auth.uid()', () => {
      const s = fs.readFileSync(MIGRATION_PATH, 'utf-8')
      expect(s).toContain('message_customer_insert')
      expect(s).toContain('WITH CHECK')
      // Sender identity must match session
      expect(s).toContain('"senderType" = \'CUSTOMER\'')
      expect(s).toContain('"senderId" = auth.uid()::text')
    })

    it('provider insert policy verifies senderType=PROVIDER and senderId=auth.uid()', () => {
      const s = fs.readFileSync(MIGRATION_PATH, 'utf-8')
      expect(s).toContain('message_provider_insert')
      expect(s).toContain('"senderType" = \'PROVIDER\'')
      // Symmetric with customer: senderId must match auth.uid() to prevent spoofing
      expect(s).toMatch(/message_provider_insert[\s\S]*"senderId" = auth\.uid\(\)::text/)
    })
  })

  describe('Message UPDATE: column-level GRANT (D10 defense-in-depth)', () => {
    it('revokes broad UPDATE from authenticated users', () => {
      const s = fs.readFileSync(MIGRATION_PATH, 'utf-8')
      expect(s).toContain('REVOKE UPDATE ON public."Message" FROM authenticated')
    })

    it('grants UPDATE only on readAt column', () => {
      const s = fs.readFileSync(MIGRATION_PATH, 'utf-8')
      expect(s).toContain('GRANT UPDATE ("readAt") ON public."Message" TO authenticated')
    })

    it('customer update policy: can only mark PROVIDER messages as read (not own)', () => {
      const s = fs.readFileSync(MIGRATION_PATH, 'utf-8')
      expect(s).toContain('message_customer_read_update')
      // USING ensures customer can only touch messages sent by PROVIDER
      expect(s).toMatch(/message_customer_read_update[\s\S]*"senderType" = 'PROVIDER'/)
      expect(s).toContain('WITH CHECK')
    })

    it('provider update policy: can only mark CUSTOMER messages as read (not own)', () => {
      const s = fs.readFileSync(MIGRATION_PATH, 'utf-8')
      expect(s).toContain('message_provider_read_update')
      // USING ensures provider can only touch messages sent by CUSTOMER
      expect(s).toMatch(/message_provider_read_update[\s\S]*"senderType" = 'CUSTOMER'/)
      expect(s).toContain('WITH CHECK')
    })
  })
})
