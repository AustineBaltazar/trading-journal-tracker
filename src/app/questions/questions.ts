import { Component, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';

@Component({
  imports: [FormsModule],
  selector: 'app-questions',
  styleUrl: './questions.css',
  templateUrl: './questions.html',
})
export class Questions implements OnInit {
  private http = inject(HttpClient);

  questions = signal<any[]>([]);
  newQuestionText = '';
  errorMessage = '';

  ngOnInit() {
    this.loadQuestions();
  }

  loadQuestions() {
    const token = localStorage.getItem('token');
    this.http
      .get<any>('http://localhost:3001/questions', {
        headers: { Authorization: `Bearer ${token}` },
      })
      .subscribe((response) => {
        this.questions.set(response.questions);
      });
  }

  addQuestion() {
    this.errorMessage = '';
    const token = localStorage.getItem('token');

    this.http
      .post<any>(
        'http://localhost:3001/questions',
        { question_text: this.newQuestionText },
        { headers: { Authorization: `Bearer ${token}` } },
      )
      .subscribe({
        next: (newQuestion) => {
          this.questions.update((current) => [...current, newQuestion]);
          this.newQuestionText = '';
        },
        error: (err) => {
          this.errorMessage = err.error?.error || 'Something went wrong adding the question.';
        },
      });
  }

  deleteQuestion(id: number) {
    const token = localStorage.getItem('token');
    this.http
      .delete<any>(`http://localhost:3001/questions/${id}`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      .subscribe(() => {
        this.questions.update((current) => current.filter((q) => q.id !== id));
      });
  }
}
