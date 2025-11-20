import { Component, Input, Output, EventEmitter, forwardRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';

export interface DropdownOption {
  value: string | number;
  label: string;
  disabled?: boolean;
}

@Component({
  selector: 'app-custom-dropdown',
  templateUrl: './custom-dropdown.component.html',
  styleUrls: ['./custom-dropdown.component.css'],
  standalone: true,
  imports: [CommonModule],
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => CustomDropdownComponent),
      multi: true
    }
  ]
})
export class CustomDropdownComponent implements ControlValueAccessor {
  @Input() options: DropdownOption[] = [];
  @Input() placeholder: string = 'Select an option';
  @Input() label: string = '';
  @Input() hasError: boolean = false;
  @Input() maxHeight: string = '200px'; // Compact height with scroll
  
  @Output() selectionChange = new EventEmitter<any>();
  
  selectedValue: any = null;
  isOpen: boolean = false;
  disabled: boolean = false;
  
  private onChange: (value: any) => void = () => {};
  private onTouched: () => void = () => {};

  get displayValue(): string {
    if (this.selectedValue !== null && this.selectedValue !== undefined && this.selectedValue !== '') {
      const selected = this.options.find(opt => opt.value === this.selectedValue);
      return selected ? selected.label : this.placeholder;
    }
    return this.placeholder;
  }

  writeValue(value: any): void {
    this.selectedValue = value;
  }

  registerOnChange(fn: (value: any) => void): void {
    this.onChange = fn;
  }

  registerOnTouched(fn: () => void): void {
    this.onTouched = fn;
  }

  setDisabledState(isDisabled: boolean): void {
    this.disabled = isDisabled;
  }

  toggleDropdown(): void {
    if (!this.disabled) {
      this.isOpen = !this.isOpen;
      if (this.isOpen) {
        this.onTouched();
      }
    }
  }

  selectOption(option: DropdownOption): void {
    if (!option.disabled && !this.disabled) {
      this.selectedValue = option.value;
      this.onChange(option.value);
      this.selectionChange.emit(option.value);
      this.isOpen = false;
    }
  }

  closeDropdown(): void {
    this.isOpen = false;
  }
}
