import { Component, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../environments/environment';

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
    this.http.get<any>(`${environment.apiUrl}/questions`).subscribe((response) => {
      this.questions.set(response.questions);
    });
  }

  addQuestion() {
    this.errorMessage = '';

    this.http
      .post<any>(`${environment.apiUrl}/questions`, { question_text: this.newQuestionText })
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
    this.http.delete<any>(`${environment.apiUrl}/questions/${id}`).subscribe(() => {
      this.questions.update((current) => current.filter((q) => q.id !== id));
    });
  }
}
