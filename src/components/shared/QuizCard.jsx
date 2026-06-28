import { Clock, Target, RotateCcw, HelpCircle } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'

export function QuizCard({ quiz, questionCount, attemptsLeft, onStart }) {
  return (
    <Card>
      <CardContent className="p-5 space-y-4">
        <div className="flex items-start justify-between">
          <h3 className="font-semibold text-foreground">{quiz.title}</h3>
          <Badge variant="outline">{questionCount} questions</Badge>
        </div>
        <div className="grid grid-cols-3 gap-3 text-sm">
          <div className="flex items-center gap-2 text-muted-foreground">
            <Target className="h-4 w-4" />
            <span>{quiz.passing_score}% to pass</span>
          </div>
          <div className="flex items-center gap-2 text-muted-foreground">
            <Clock className="h-4 w-4" />
            <span>{quiz.time_limit_min} min</span>
          </div>
          <div className="flex items-center gap-2 text-muted-foreground">
            <RotateCcw className="h-4 w-4" />
            <span>{attemptsLeft} left</span>
          </div>
        </div>
        <Button className="w-full" onClick={onStart} disabled={attemptsLeft <= 0}>
          <HelpCircle className="h-4 w-4" />
          Start Quiz
        </Button>
      </CardContent>
    </Card>
  )
}
