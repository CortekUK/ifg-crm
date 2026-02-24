'use client'

import { Card, CardContent, CardFooter, CardHeader } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Play, LucideIcon } from 'lucide-react'

interface ReportCardProps {
  icon: LucideIcon
  name: string
  description: string
  format: string
  onGenerate: () => void
}

export function ReportCard({
  icon: Icon,
  name,
  description,
  format,
  onGenerate,
}: ReportCardProps) {
  return (
    <Card className="flex flex-col">
      <CardHeader className="pb-3">
        <div className="flex items-start gap-3">
          <div className="p-2.5 rounded-lg bg-blue-50 dark:bg-blue-900/50">
            <Icon className="h-5 w-5 text-blue-600 dark:text-blue-400" />
          </div>
          <div className="flex-1">
            <h3 className="font-semibold text-gray-900 dark:text-white">{name}</h3>
            <p className="text-sm text-muted-foreground mt-1">{description}</p>
          </div>
        </div>
      </CardHeader>

      <CardContent className="flex-1 pb-3">
        <div className="flex items-center gap-4 text-sm">
          <div>
            <span className="text-muted-foreground">Format:</span>{' '}
            <span className="font-medium">{format}</span>
          </div>
        </div>
      </CardContent>

      <CardFooter className="pt-0">
        <Button onClick={onGenerate} size="sm" className="w-full">
          <Play className="h-4 w-4 mr-1" />
          Generate
        </Button>
      </CardFooter>
    </Card>
  )
}
