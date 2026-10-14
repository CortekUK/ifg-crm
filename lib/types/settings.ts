export type SettingsSection =
  | 'profile'
  | 'general'
  | 'calendly'
  | 'outlook'
  | 'notifications'
  | 'data'

export interface GeneralSettings {
  companyName: string
  defaultCurrency: string
  timezone: string
  dateFormat: string
  logoUrl: string | null
}

export interface IntegrationStatus {
  connected: boolean
  lastChecked: string | null
}

export interface ResendSettings {
  apiKey: string
  verifiedDomains: string[]
}

export interface StripeSettings {
  connected: boolean
  webhookUrl: string
}

export interface XeroSettings {
  connected: boolean
}

export interface NotificationSettings {
  emailNotifications: {
    newLead: boolean
    emailReply: boolean
    paymentReceived: boolean
    dealWon: boolean
  }
  browserNotifications: boolean
}
