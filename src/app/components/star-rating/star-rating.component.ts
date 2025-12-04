import { Component, Input, Output, EventEmitter, forwardRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';

@Component({
  selector: 'app-star-rating',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './star-rating.component.html',
  styleUrls: ['./star-rating.component.css'],
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => StarRatingComponent),
      multi: true,
    },
  ],
})
export class StarRatingComponent implements ControlValueAccessor {
  @Input() rating: number = 0;
  @Input() maxStars: number = 5;
  @Input() readonly: boolean = false;
  @Input() size: 'small' | 'medium' | 'large' = 'medium';
  @Output() ratingChange = new EventEmitter<number>();

  hoveredRating: number = 0;
  stars: number[] = [];

  private onChange: (value: number) => void = () => {};
  private onTouched: () => void = () => {};

  ngOnInit(): void {
    this.stars = Array(this.maxStars)
      .fill(0)
      .map((_, i) => i + 1);
  }

  // ControlValueAccessor implementation
  writeValue(value: number): void {
    this.rating = value || 0;
  }

  registerOnChange(fn: (value: number) => void): void {
    this.onChange = fn;
  }

  registerOnTouched(fn: () => void): void {
    this.onTouched = fn;
  }

  setDisabledState(isDisabled: boolean): void {
    this.readonly = isDisabled;
  }

  // Star interaction methods
  onStarClick(star: number): void {
    if (!this.readonly) {
      this.rating = star;
      this.ratingChange.emit(this.rating);
      this.onChange(this.rating);
      this.onTouched();
    }
  }

  onStarHover(star: number): void {
    if (!this.readonly) {
      this.hoveredRating = star;
    }
  }

  onMouseLeave(): void {
    this.hoveredRating = 0;
  }

  isStarFilled(star: number): boolean {
    const displayRating = this.hoveredRating || this.rating;
    return star <= displayRating;
  }

  isStarHalf(star: number): boolean {
    const displayRating = this.hoveredRating || this.rating;
    return star === Math.ceil(displayRating) && displayRating % 1 !== 0;
  }

  getStarClass(star: number): string {
    const classes = ['star'];

    if (this.isStarFilled(star)) {
      classes.push('filled');
    } else if (this.isStarHalf(star)) {
      classes.push('half');
    } else {
      classes.push('empty');
    }

    if (!this.readonly) {
      classes.push('interactive');
    }

    classes.push(`size-${this.size}`);

    return classes.join(' ');
  }
}
