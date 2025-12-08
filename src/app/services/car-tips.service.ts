import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of, throwError } from 'rxjs';
import { map, catchError } from 'rxjs/operators';

export interface CarTip {
  id: string | number;
  title: string;
  excerpt: string;
  category: string;
  icon: string;
  timeAgo: string;
  readTime: number;
  content: string;
  source?: string;
  url?: string;
  imageUrl?: string;
  publishedAt?: Date;
}

export interface WeatherData {
  temp: number;
  condition: string;
  humidity: number;
  description: string;
}

@Injectable({
  providedIn: 'root'
})
export class CarTipsService {
  // ===== API CONFIGURATION =====
  // To use these APIs, sign up for free API keys:
  // 1. NewsAPI: https://newsapi.org/ (100 requests/day free)
  // 2. OpenWeatherMap: https://openweathermap.org/api (1000 calls/day free)

  private readonly NEWS_API_KEY = 'YOUR_NEWS_API_KEY'; // Replace with your key
  private readonly NEWS_API_URL = 'https://newsapi.org/v2/everything';

  private readonly WEATHER_API_KEY = 'YOUR_WEATHER_API_KEY'; // Replace with your key
  private readonly WEATHER_API_URL = 'https://api.openweathermap.org/data/2.5/weather';

  // Category icons and keywords
  private readonly categoryConfig = {
    'Seasonal': { icon: '❄️', keywords: 'winter driving, summer car care, seasonal maintenance' },
    'Fuel': { icon: '⛽', keywords: 'fuel efficiency, gas saving, mpg tips' },
    'Maintenance': { icon: '🔧', keywords: 'car maintenance, oil change, tire rotation' },
    'Safety': { icon: '🛡️', keywords: 'car safety, driving tips, accident prevention' },
    'Electric': { icon: '🔋', keywords: 'electric vehicles, EV charging, hybrid cars' },
    'Technology': { icon: '💡', keywords: 'car technology, automotive innovation, smart cars' }
  };

  // Fallback curated tips (when API is unavailable or rate limited)
  private readonly fallbackTips: CarTip[] = [
    {
      id: 'fb-1',
      title: 'Winter Tire Safety: When to Switch',
      excerpt: 'Learn the optimal time to switch to winter tires and how they can significantly improve your vehicle\'s safety during cold months.',
      category: 'Seasonal',
      icon: '❄️',
      timeAgo: '2 hours ago',
      readTime: 4,
      content: 'When temperatures consistently drop below 45°F (7°C), it\'s time to switch to winter tires. Winter tires use specialized rubber compounds that remain flexible in cold weather, providing better traction on snow, ice, and cold pavement. Regular all-season tires become stiff and lose grip in freezing conditions.',
      source: 'Automotive Safety Foundation'
    },
    {
      id: 'fb-2',
      title: 'Top 5 Fuel-Saving Driving Habits',
      excerpt: 'Discover proven techniques to reduce fuel consumption and save money on every trip.',
      category: 'Fuel',
      icon: '⛽',
      timeAgo: '1 day ago',
      readTime: 3,
      content: '1. Maintain steady speed using cruise control. 2. Avoid aggressive acceleration and braking. 3. Remove excess weight from your vehicle. 4. Keep tires properly inflated. 5. Use the recommended grade of motor oil. These simple habits can improve fuel economy by 10-15%.',
      source: 'Department of Energy'
    },
    {
      id: 'fb-3',
      title: 'Essential Oil Change Intervals',
      excerpt: 'Understanding when to change your oil can extend engine life and prevent costly repairs.',
      category: 'Maintenance',
      icon: '🔧',
      timeAgo: '3 days ago',
      readTime: 5,
      content: 'Modern synthetic oils can last 7,500-10,000 miles between changes. However, severe driving conditions (extreme temperatures, short trips, towing) require more frequent changes. Always check your owner\'s manual for manufacturer recommendations. Regular oil changes are the single most important maintenance task for engine longevity.',
      source: 'Automotive Maintenance Guide'
    },
    {
      id: 'fb-4',
      title: 'Electric Vehicle Charging Best Practices',
      excerpt: 'Maximize your EV battery life with these charging tips.',
      category: 'Electric',
      icon: '🔋',
      timeAgo: '5 days ago',
      readTime: 4,
      content: 'To extend EV battery life: Keep charge between 20-80% for daily use, avoid fast charging for every charge, don\'t leave the battery at 100% for extended periods, and precondition the battery in extreme temperatures. These habits can significantly extend your battery\'s lifespan.',
      source: 'EV Technology Institute'
    },
    {
      id: 'fb-5',
      title: 'How to Check Your Tire Pressure',
      excerpt: 'Proper tire pressure improves safety, fuel economy, and tire life.',
      category: 'Safety',
      icon: '🛡️',
      timeAgo: '1 week ago',
      readTime: 3,
      content: 'Check tire pressure monthly when tires are cold (before driving). Find the recommended PSI on the driver\'s door jamb sticker, not on the tire sidewall. Underinflated tires reduce fuel economy and increase wear. Overinflated tires reduce traction and create a harsh ride.',
      source: 'National Highway Safety Administration'
    }
  ];

  constructor(private http: HttpClient) {}

  /**
   * Get car tips from NewsAPI with fallback to curated content
   */
  getCarTips(limit: number = 5): Observable<CarTip[]> {
    // If API key is not configured, return fallback tips
    if (this.NEWS_API_KEY === 'YOUR_NEWS_API_KEY') {
      console.log('📰 NewsAPI key not configured - using curated tips');
      return of(this.fallbackTips.slice(0, limit));
    }

    // Build search query for automotive content
    const searchQuery = 'car maintenance OR fuel efficiency OR driving tips OR automotive care';
    const params = {
      q: searchQuery,
      language: 'en',
      sortBy: 'publishedAt',
      pageSize: limit.toString(),
      apiKey: this.NEWS_API_KEY
    };

    return this.http.get<any>(this.NEWS_API_URL, { params }).pipe(
      map(response => {
        if (response.status === 'ok' && response.articles) {
          return response.articles.map((article: any, index: number) =>
            this.mapNewsArticleToTip(article, index)
          );
        }
        return this.fallbackTips.slice(0, limit);
      }),
      catchError(error => {
        console.error('Error fetching tips from NewsAPI:', error);
        return of(this.fallbackTips.slice(0, limit));
      })
    );
  }

  /**
   * Get weather-based car care tips
   */
  getWeatherBasedTips(latitude: number, longitude: number): Observable<CarTip[]> {
    if (this.WEATHER_API_KEY === 'YOUR_WEATHER_API_KEY') {
      console.log('🌤️ Weather API key not configured - skipping weather tips');
      return of([]);
    }

    const params = {
      lat: latitude.toString(),
      lon: longitude.toString(),
      units: 'metric',
      appid: this.WEATHER_API_KEY
    };

    return this.http.get<any>(this.WEATHER_API_URL, { params }).pipe(
      map(response => this.generateWeatherBasedTips(response)),
      catchError(error => {
        console.error('Error fetching weather data:', error);
        return of([]);
      })
    );
  }

  /**
   * Get tips by category
   */
  getTipsByCategory(category: string): Observable<CarTip[]> {
    const config = this.categoryConfig[category as keyof typeof this.categoryConfig];
    if (!config) {
      return of([]);
    }

    // If API key not configured, filter fallback tips
    if (this.NEWS_API_KEY === 'YOUR_NEWS_API_KEY') {
      const filtered = this.fallbackTips.filter(tip => tip.category === category);
      return of(filtered);
    }

    const params = {
      q: config.keywords,
      language: 'en',
      sortBy: 'publishedAt',
      pageSize: '10',
      apiKey: this.NEWS_API_KEY
    };

    return this.http.get<any>(this.NEWS_API_URL, { params }).pipe(
      map(response => {
        if (response.status === 'ok' && response.articles) {
          return response.articles.map((article: any, index: number) =>
            this.mapNewsArticleToTip(article, index, category)
          );
        }
        return this.fallbackTips.filter(tip => tip.category === category);
      }),
      catchError(() => of(this.fallbackTips.filter(tip => tip.category === category)))
    );
  }

  /**
   * Map NewsAPI article to CarTip format
   */
  private mapNewsArticleToTip(article: any, index: number, forceCategory?: string): CarTip {
    const category = forceCategory || this.detectCategory(article.title + ' ' + article.description);
    const categoryIcon = this.categoryConfig[category as keyof typeof this.categoryConfig]?.icon || '🚗';

    return {
      id: `news-${Date.now()}-${index}`,
      title: article.title || 'Car Tips',
      excerpt: article.description || article.content?.substring(0, 150) || 'Read more about this automotive topic.',
      category: category,
      icon: categoryIcon,
      timeAgo: this.getTimeAgo(new Date(article.publishedAt)),
      readTime: this.estimateReadTime(article.content || article.description || ''),
      content: article.content || article.description || '',
      source: article.source?.name || 'Automotive News',
      url: article.url,
      imageUrl: article.urlToImage,
      publishedAt: new Date(article.publishedAt)
    };
  }

  /**
   * Generate weather-based car care tips
   */
  private generateWeatherBasedTips(weatherData: any): CarTip[] {
    const tips: CarTip[] = [];
    const temp = weatherData.main?.temp || 20;
    const condition = (weatherData.weather && weatherData.weather[0]?.main) || 'Clear';
    const humidity = weatherData.main?.humidity || 50;

    // Cold weather tip
    if (temp < 5) {
      tips.push({
        id: 'weather-cold',
        title: 'Cold Weather Alert: Protect Your Vehicle',
        excerpt: `Temperature is ${temp}°C. Take precautions to protect your car from freezing conditions.`,
        category: 'Seasonal',
        icon: '❄️',
        timeAgo: 'Just now',
        readTime: 3,
        content: `Current temperature: ${temp}°C. Cold weather tips: 1) Use winter-grade windshield washer fluid. 2) Check battery health - cold reduces battery capacity. 3) Keep gas tank at least half full to prevent fuel line freeze. 4) Let engine warm up for 30 seconds before driving. 5) Check tire pressure - tires lose 1 PSI for every 10°F drop.`,
        source: 'Local Weather Station'
      });
    }

    // Hot weather tip
    if (temp > 30) {
      tips.push({
        id: 'weather-hot',
        title: 'Hot Weather Care: Keep Your Car Cool',
        excerpt: `Temperature is ${temp}°C. Protect your vehicle from heat damage.`,
        category: 'Seasonal',
        icon: '☀️',
        timeAgo: 'Just now',
        readTime: 3,
        content: `Current temperature: ${temp}°C. Hot weather tips: 1) Park in shade when possible. 2) Check coolant levels regularly. 3) Inspect AC system performance. 4) Monitor tire pressure - heat causes expansion. 5) Use sunshade to protect dashboard and interior.`,
        source: 'Local Weather Station'
      });
    }

    // Rain tip
    if (condition === 'Rain' || condition === 'Drizzle') {
      tips.push({
        id: 'weather-rain',
        title: 'Rainy Weather Driving Tips',
        excerpt: 'Rain detected in your area. Drive safely with these wet weather tips.',
        category: 'Safety',
        icon: '🌧️',
        timeAgo: 'Just now',
        readTime: 2,
        content: 'Rainy conditions ahead: 1) Reduce speed and increase following distance. 2) Turn on headlights for visibility. 3) Avoid sudden braking or steering. 4) Check wiper blade condition. 5) Be alert for hydroplaning on wet roads.',
        source: 'Local Weather Station'
      });
    }

    return tips;
  }

  /**
   * Detect category from article content
   */
  private detectCategory(text: string): string {
    const lowerText = text.toLowerCase();

    if (lowerText.includes('winter') || lowerText.includes('summer') || lowerText.includes('season')) {
      return 'Seasonal';
    }
    if (lowerText.includes('fuel') || lowerText.includes('gas') || lowerText.includes('mpg')) {
      return 'Fuel';
    }
    if (lowerText.includes('maintenance') || lowerText.includes('oil') || lowerText.includes('service')) {
      return 'Maintenance';
    }
    if (lowerText.includes('safety') || lowerText.includes('accident') || lowerText.includes('crash')) {
      return 'Safety';
    }
    if (lowerText.includes('electric') || lowerText.includes('ev') || lowerText.includes('hybrid')) {
      return 'Electric';
    }
    if (lowerText.includes('technology') || lowerText.includes('innovation') || lowerText.includes('smart')) {
      return 'Technology';
    }

    return 'Maintenance'; // Default category
  }

  /**
   * Calculate time ago string
   */
  private getTimeAgo(date: Date): string {
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 60) {
      return `${diffMins} min${diffMins !== 1 ? 's' : ''} ago`;
    } else if (diffHours < 24) {
      return `${diffHours} hour${diffHours !== 1 ? 's' : ''} ago`;
    } else if (diffDays < 7) {
      return `${diffDays} day${diffDays !== 1 ? 's' : ''} ago`;
    } else {
      return date.toLocaleDateString();
    }
  }

  /**
   * Estimate reading time based on content length
   */
  private estimateReadTime(content: string): number {
    const wordsPerMinute = 200;
    const wordCount = content.split(/\s+/).length;
    const readTime = Math.ceil(wordCount / wordsPerMinute);
    return Math.max(1, Math.min(readTime, 10)); // Between 1-10 minutes
  }

  /**
   * Get all fallback tips (useful for offline mode)
   */
  getFallbackTips(): CarTip[] {
    return [...this.fallbackTips];
  }
}
