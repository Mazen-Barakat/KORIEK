import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

export type StatCardVariant = 'primary' | 'success' | 'warning' | 'info';

@Component({
  selector: 'app-stat-card',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './stat-card.component.html',
  styleUrls: ['./stat-card.component.css']
})
export class StatCardComponent {
  // Expose Math for template
  Math = Math;

  @Input() icon: string = '';
  @Input() label: string = '';
  @Input() value: string | number = 0;
  @Input() trend?: number; // percentage change
  @Input() variant: StatCardVariant = 'primary';
  @Input() loading: boolean = false;

  get variantClass(): string {
    return `variant-${this.variant}`;
  }

  get trendDirection(): 'up' | 'down' | 'neutral' {
    if (!this.trend) return 'neutral';
    return this.trend > 0 ? 'up' : this.trend < 0 ? 'down' : 'neutral';
  }

  get trendClass(): string {
    return `trend-${this.trendDirection}`;
  }
}
