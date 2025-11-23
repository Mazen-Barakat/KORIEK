import { TestBed } from '@angular/core/testing';
import { GeolocationService } from './geolocation.service';

describe('GeolocationService', () => {
  let service: GeolocationService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(GeolocationService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('should check if geolocation is supported', () => {
    const isSupported = service.isGeolocationSupported();
    expect(typeof isSupported).toBe('boolean');
  });

  it('should handle location request', (done) => {
    // Mock geolocation
    const mockGeolocation = {
      getCurrentPosition: jasmine.createSpy('getCurrentPosition').and.callFake(
        (success: PositionCallback) => {
          const position: GeolocationPosition = {
            coords: {
              latitude: 30.0444,
              longitude: 31.2357,
              accuracy: 10,
              altitude: null,
              altitudeAccuracy: null,
              heading: null,
              speed: null
            },
            timestamp: Date.now()
          };
          success(position);
        }
      )
    };

    Object.defineProperty(window.navigator, 'geolocation', {
      value: mockGeolocation,
      writable: true
    });

    service.requestLocation().subscribe({
      next: (position) => {
        expect(position.latitude).toBe(30.0444);
        expect(position.longitude).toBe(31.2357);
        done();
      }
    });
  });

  it('should handle permission denied error', (done) => {
    const mockGeolocation = {
      getCurrentPosition: jasmine.createSpy('getCurrentPosition').and.callFake(
        (success: PositionCallback, error: PositionErrorCallback) => {
          const geoError: GeolocationPositionError = {
            code: 1,
            message: 'User denied geolocation',
            PERMISSION_DENIED: 1,
            POSITION_UNAVAILABLE: 2,
            TIMEOUT: 3
          };
          error(geoError);
        }
      )
    };

    Object.defineProperty(window.navigator, 'geolocation', {
      value: mockGeolocation,
      writable: true
    });

    service.getLocationErrors().subscribe({
      next: (error) => {
        expect(error.code).toBe(1);
        expect(error.message).toContain('denied');
        done();
      }
    });

    service.requestLocation().subscribe();
  });
});
