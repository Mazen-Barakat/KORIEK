import { ComponentFixture, TestBed } from '@angular/core/testing';

import { AddVehicleForm } from './add-vehicle-form';

describe('AddVehicleForm', () => {
  let component: AddVehicleForm;
  let fixture: ComponentFixture<AddVehicleForm>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AddVehicleForm]
    })
    .compileComponents();

    fixture = TestBed.createComponent(AddVehicleForm);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
