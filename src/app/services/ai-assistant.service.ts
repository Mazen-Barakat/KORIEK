import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable, BehaviorSubject } from 'rxjs';
import { tap, catchError } from 'rxjs/operators';

export interface AIMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  isTyping?: boolean;
}

export interface AIRequest {
  Message: string;
}

export interface AIResponse {
  success: boolean;
  message: string;
  data?: {
    response: string;
    isSuccess: boolean;
    actionTaken: any;
  };
  response?: string;
}

@Injectable({
  providedIn: 'root'
})
export class AiAssistantService {
  private readonly API_BASE_URL = 'https://korik-demo.runasp.net/api';
  private readonly STORAGE_KEY = 'ai_conversation';
  
  private messagesSubject = new BehaviorSubject<AIMessage[]>([]);
  public messages$ = this.messagesSubject.asObservable();
  
  private isTypingSubject = new BehaviorSubject<boolean>(false);
  public isTyping$ = this.isTypingSubject.asObservable();

  constructor(private http: HttpClient) {
    this.loadMessagesFromStorage();
  }

  /**
   * Generate unique message ID
   */
  private generateId(): string {
    return `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Send a message to the AI assistant
   */
  askAI(message: string): Observable<AIResponse> {
    const headers = new HttpHeaders({
      'Content-Type': 'application/json'
    });

    // Backend expects a raw JSON string, not an object
    const body = JSON.stringify(message);

    // Add user message to conversation
    this.addMessage('user', message);
    
    // Set typing indicator
    this.isTypingSubject.next(true);

    return this.http.post<AIResponse>(`${this.API_BASE_URL}/AI/ask`, body, { headers }).pipe(
      tap((response: AIResponse) => {
        this.isTypingSubject.next(false);
        
        // Extract response from nested data structure or direct response
        let aiResponse = '';
        if (response.data?.response) {
          aiResponse = response.data.response;
        } else if (response.response) {
          aiResponse = response.response;
        } else if (response.message && response.success) {
          aiResponse = response.message;
        }
        
        if (aiResponse) {
          this.addMessage('assistant', aiResponse);
        }
      }),
      catchError((error) => {
        this.isTypingSubject.next(false);
        console.error('AI Assistant Error:', error);
        this.addMessage('assistant', 'I apologize, but I encountered an issue processing your request. Please try again in a moment.');
        throw error;
      })
    );
  }

  /**
   * Add a message to the conversation history
   */
  private addMessage(role: 'user' | 'assistant', content: string): void {
    const currentMessages = this.messagesSubject.value;
    const newMessage: AIMessage = {
      id: this.generateId(),
      role,
      content,
      timestamp: new Date()
    };
    
    const updatedMessages = [...currentMessages, newMessage];
    
    // Keep only last 50 messages to prevent storage overflow
    const trimmedMessages = updatedMessages.slice(-50);
    
    this.messagesSubject.next(trimmedMessages);
    this.saveMessagesToStorage(trimmedMessages);
  }

  /**
   * Get current conversation history
   */
  getMessages(): AIMessage[] {
    return this.messagesSubject.value;
  }

  /**
   * Clear conversation history
   */
  clearConversation(): void {
    this.messagesSubject.next([]);
    localStorage.removeItem(this.STORAGE_KEY);
  }

  /**
   * Save messages to localStorage for persistence
   */
  private saveMessagesToStorage(messages: AIMessage[]): void {
    try {
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(messages));
    } catch (error) {
      console.error('Failed to save AI conversation:', error);
    }
  }

  /**
   * Load messages from localStorage
   */
  private loadMessagesFromStorage(): void {
    try {
      const stored = localStorage.getItem(this.STORAGE_KEY);
      if (stored) {
        const messages = JSON.parse(stored) as AIMessage[];
        const parsedMessages = messages.map(msg => ({
          ...msg,
          timestamp: new Date(msg.timestamp)
        }));
        this.messagesSubject.next(parsedMessages);
      }
    } catch (error) {
      console.error('Failed to load AI conversation:', error);
    }
  }

  /**
   * Get quick action prompts
   */
  getQuickActions(): { label: string; prompt: string; icon: string }[] {
    return [
      {
        label: 'Schedule Maintenance',
        prompt: 'Help me schedule a maintenance service for my vehicle',
        icon: 'wrench'
      },
      {
        label: 'Get Care Tips',
        prompt: 'Give me maintenance tips for my vehicles',
        icon: 'lightbulb'
      },
      {
        label: 'Check Diagnostics',
        prompt: 'Check diagnostics and health status for all my vehicles',
        icon: 'activity'
      },
      {
        label: 'View History',
        prompt: 'Show me my maintenance history and upcoming services',
        icon: 'clock'
      }
    ];
  }
}
