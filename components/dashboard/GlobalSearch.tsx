'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { Search, User, GitBranch, FileText, Zap, Loader2 } from 'lucide-react'
import { useGlobalSearch, SearchResult } from '@/lib/hooks/useGlobalSearch'
import { useDebouncedValue } from '@/lib/hooks/useDebouncedValue'
import { cn } from '@/lib/utils'

const typeConfig: Record<SearchResult['type'], { icon: typeof User; label: string; color: string }> = {
  contact: { icon: User, label: 'Contact', color: 'bg-blue-100 dark:bg-blue-900/50 text-blue-700' },
  deal: { icon: GitBranch, label: 'Deal', color: 'bg-green-100 dark:bg-green-900/50 text-green-700' },
  template: { icon: FileText, label: 'Template', color: 'bg-purple-100 dark:bg-purple-900/50 text-purple-700' },
  automation: { icon: Zap, label: 'Automation', color: 'bg-orange-100 dark:bg-orange-900/50 text-orange-700' },
}

export function GlobalSearch() {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)
  
  const debouncedQuery = useDebouncedValue(query, 300)
  const { data: results = [], isLoading } = useGlobalSearch(debouncedQuery)

  // Keyboard shortcut (Cmd+K or Ctrl+K)
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault()
        setOpen((open) => !open)
      }
    }

    document.addEventListener('keydown', down)
    return () => document.removeEventListener('keydown', down)
  }, [])

  // Focus input when popover opens
  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 0)
    } else {
      setQuery('')
    }
  }, [open])

  const handleSelect = (result: SearchResult) => {
    setOpen(false)
    setQuery('')
    router.push(result.href)
  }

  // Group results by type
  const groupedResults = results.reduce((acc, result) => {
    if (!acc[result.type]) {
      acc[result.type] = []
    }
    acc[result.type].push(result)
    return acc
  }, {} as Record<string, SearchResult[]>)

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button 
          className="relative hidden md:flex items-center"
          onClick={() => setOpen(true)}
        >
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <div className="pl-9 pr-14 w-56 h-9 bg-gray-50 border border-gray-200 rounded-md flex items-center text-sm text-gray-500 hover:bg-gray-100 transition-colors">
            Search...
          </div>
          <kbd className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none inline-flex h-5 select-none items-center gap-1 rounded border border-gray-200 bg-gray-100 px-1.5 font-mono text-[10px] font-medium text-gray-500 dark:text-gray-400">
            <span className="text-xs">⌘</span>K
          </kbd>
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-[400px] p-0" align="start">
        <Command shouldFilter={false}>
          <div className="flex items-center border-b px-3">
            <Search className="mr-2 h-4 w-4 shrink-0 text-gray-400" />
            <input
              ref={inputRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search contacts, deals, templates..."
              className="flex h-11 w-full rounded-md bg-transparent py-3 text-sm outline-none placeholder:text-gray-400"
            />
            {isLoading && <Loader2 className="h-4 w-4 animate-spin text-gray-400" />}
          </div>
          <CommandList className="max-h-[300px] overflow-y-auto">
            {query.length < 2 ? (
              <div className="py-6 text-center text-sm text-gray-500 dark:text-gray-400">
                Type at least 2 characters to search...
              </div>
            ) : isLoading ? (
              <div className="p-4 space-y-3">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="flex items-center gap-3">
                    <Skeleton className="h-8 w-8 rounded" />
                    <div className="space-y-1 flex-1">
                      <Skeleton className="h-4 w-3/4" />
                      <Skeleton className="h-3 w-1/2" />
                    </div>
                  </div>
                ))}
              </div>
            ) : results.length === 0 ? (
              <CommandEmpty>No results found.</CommandEmpty>
            ) : (
              <>
                {Object.entries(groupedResults).map(([type, items]) => {
                  const config = typeConfig[type as SearchResult['type']]
                  const Icon = config.icon

                  return (
                    <CommandGroup key={type} heading={`${config.label}s`}>
                      {items.map((result) => (
                        <CommandItem
                          key={`${result.type}-${result.id}`}
                          value={`${result.type}-${result.id}`}
                          onSelect={() => handleSelect(result)}
                          className="flex items-center gap-3 px-3 py-2 cursor-pointer"
                        >
                          <div className={cn('p-1.5 rounded', config.color)}>
                            <Icon className="h-4 w-4" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">{result.title}</p>
                            <p className="text-xs text-gray-500 truncate">{result.subtitle}</p>
                          </div>
                          <Badge variant="outline" className="text-xs shrink-0">
                            {config.label}
                          </Badge>
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  )
                })}
              </>
            )}
          </CommandList>
          {results.length > 0 && (
            <div className="border-t px-3 py-2 text-xs text-gray-500 dark:text-gray-400">
              Press <kbd className="px-1 py-0.5 bg-gray-100 rounded text-[10px]">↵</kbd> to select,{' '}
              <kbd className="px-1 py-0.5 bg-gray-100 rounded text-[10px]">esc</kbd> to close
            </div>
          )}
        </Command>
      </PopoverContent>
    </Popover>
  )
}
