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
import type { RoadmapLesson } from "@/types/course"

interface DaySearchProps {
  lessons: RoadmapLesson[]
  selectedLessonId: string | null
  onSelect: (lesson: RoadmapLesson) => void
}

export function DaySearch({
  lessons,
  selectedLessonId,
  onSelect,
}: DaySearchProps) {
  const [open, setOpen] = useState(false)
  const allHaveDay = lessons.every((lesson) => lesson.day !== null)

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
          查找课次
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="day-search-popover p-0">
        <Command>
          <CommandInput
            aria-label="搜索课次或课程标题"
            placeholder="搜索课次或标题…"
            data-testid="day-search-input"
          />
          <CommandList>
            <CommandEmpty>没有匹配的课程</CommandEmpty>
            <CommandGroup
              heading={
                allHaveDay
                  ? `Day ${lessons[0]?.day ?? 0}–${lessons.at(-1)?.day ?? 0}`
                  : "全部课次"
              }
            >
              {lessons.map((lesson) => (
                <CommandItem
                  key={lesson.lessonId}
                  value={`${lesson.label} ${lesson.title}`}
                  data-checked={
                    lesson.lessonId === selectedLessonId || undefined
                  }
                  onSelect={() => {
                    onSelect(lesson)
                    setOpen(false)
                  }}
                >
                  <span className="day-search-label tabular-nums">
                    {lesson.label}
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
