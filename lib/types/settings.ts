export type SettingsSection =
  | 'profile'
  | 'general'
  | 'pipelines'
  | 'integrations'
  | 'calendly'
  | 'email'
  | 'sms'
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

export interface ClickSendSettings {
  apiUsername: string
  apiKey: string
  phoneNumberMappings: {
    phoneNumber: string
    pipelineId: string
    pipelineName: string
  }[]
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

export interface EmailSettings {
  defaultFromName: string
  defaultFromEmail: string
  replyToEmail: string
  emailSignature: string
  unsubscribeFooter: string
}

export interface SMSSettings {
  defaultSMSNumber: string
  smsSignature: string
  characterLimitWarning: number
}

export interface NotificationSettings {
  emailNotifications: {
    newLead: boolean
    smsReply: boolean
    emailReply: boolean
    paymentReceived: boolean
    dealWon: boolean
  }
  browserNotifications: boolean
}
