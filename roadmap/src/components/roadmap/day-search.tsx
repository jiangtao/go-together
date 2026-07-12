import { useState } from "react"
import { SearchIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import type { CourseLesson } from "@/types/course"

interface DaySearchProps {
  lessons: CourseLesson[]
  selectedDay: number
  onSelect: (lesson: CourseLesson) => void
}

export function DaySearch({
  lessons,
  selectedDay,
  onSelect,
}: DaySearchProps) {
  const [open, setOpen] = useState(false)

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="sm"
          aria-expanded={open}
          data-testid="day-search-trigger"
        >
          <SearchIcon data-icon="inline-start" />
          查找 Day
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="day-search-popover p-0">
        <Command>
          <CommandInput
            aria-label="搜索 Day 或课程标题"
            placeholder="搜索 Day 或标题…"
            data-testid="day-search-input"
          />
          <CommandList>
            <CommandEmpty>没有匹配的课程</CommandEmpty>
            <CommandGroup heading="Day 0–36">
              {lessons.map((lesson) => (
                <CommandItem
                  key={lesson.id}
                  value={`${lesson.dayLabel} ${lesson.title}`}
                  data-checked={lesson.day === selectedDay || undefined}
                  onSelect={() => {
                    onSelect(lesson)
                    setOpen(false)
                  }}
                >
                  <span className="day-search-label tabular-nums">
                    {lesson.dayLabel}
                  </span>
                  <span className="min-w-0 flex-1 truncate">
                    {lesson.title}
                  </span>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
