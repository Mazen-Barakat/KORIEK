import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';

export type ActionBadgePriority = 'high' | 'medium' | 'low';

@Component({
  selector: 'app-action-badge',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './action-badge.component.html',
  styleUrls: ['./action-badge.component.css']
})
export class ActionBadgeComponent {
  @Input() count: number = 0;
  @Input() label: string = '';
  @Input() priority: ActionBadgePriority = 'medium';
  @Input() icon?: string;
  @Output() clicked = new EventEmitter<void>();

  onClick() {
    this.clicked.emit();
  }

  get priorityClass(): string {
    return `priority-${this.priority}`;
  }

  get showUrgentIndicator(): boolean {
    return this.priority === 'high' && this.count > 0;
  }
}
