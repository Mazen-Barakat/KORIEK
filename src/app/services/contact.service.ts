import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class ContactService {
  private _openSubject = new BehaviorSubject<boolean>(false);
  public open$ = this._openSubject.asObservable();

  open(): void {
    this._openSubject.next(true);
  }

  close(): void {
    this._openSubject.next(false);
  }
}
