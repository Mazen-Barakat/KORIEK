import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, ActivatedRoute, RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { BookingService } from '../../services/booking.service';
import { Job, Quote, ServiceItem, PartItem, ChatMessage, MediaItem, AdditionalRepair } from '../../models/booking.model';

@Component({
  selector: 'app-job-detail',
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule],
  templateUrl: './job-detail.component.html',
  styleUrls: ['./job-detail.component.css']
})
export class JobDetailComponent implements OnInit {
  job: Job | null = null;
  jobId: string = '';
  
  // Active Tab
  activeTab: 'overview' | 'quote' | 'chat' | 'media' = 'overview';
  
  // Quote Builder
  quoteForm = {
    services: [] as ServiceItem[],
    parts: [] as PartItem[],
    laborCost: 0,
    partsCost: 0,
    tax: 0.15, // 15% tax
    discount: 0
  };
  
  newService: Partial<ServiceItem> = {
    name: '',
    description: '',
    duration: 60,
    price: 0,
    quantity: 1
  };
  
  newPart: Partial<PartItem> = {
    name: '',
    partNumber: '',
    price: 0,
    quantity: 1
  };
  
  // Chat
  newMessage: string = '';
  
  // Media Upload
  uploadingMedia: boolean = false;
  
  // Additional Repair (Upsell)
  showUpsellForm: boolean = false;
  upsellForm = {
    title: '',
    description: '',
    estimatedCost: 0,
    media: [] as any[]
  };

  constructor(
    private bookingService: BookingService,
    private router: Router,
    private route: ActivatedRoute
  ) {}

  ngOnInit(): void {
    this.jobId = this.route.snapshot.params['id'];
    this.loadJobDetails();
  }

  private loadJobDetails(): void {
    this.bookingService.getJobById(this.jobId).subscribe({
      next: (job) => {
        if (job) {
          this.job = job;
          if (job.quote) {
            this.loadQuoteData(job.quote);
          }
        } else {
          console.error('Job not found');
          this.router.navigate(['/workshop/job-board']);
        }
      },
      error: (error) => {
        console.error('Error loading job:', error);
      }
    });
  }

  private loadQuoteData(quote: Quote): void {
    this.quoteForm.services = [...quote.services];
    this.quoteForm.parts = [...quote.parts];
    this.quoteForm.laborCost = quote.laborCost;
    this.quoteForm.partsCost = quote.partsCost;
    this.quoteForm.discount = quote.discount;
  }

  // Tab Switching
  switchTab(tab: 'overview' | 'quote' | 'chat' | 'media'): void {
    this.activeTab = tab;
  }

  // Stage Management
  updateStage(newStage: Job['stage']): void {
    if (!this.job) return;
    
    this.bookingService.updateJobStage(this.job.id, newStage).subscribe({
      next: () => {
        this.loadJobDetails();
      },
      error: (error) => {
        console.error('Error updating stage:', error);
      }
    });
  }

  getStageProgress(): number {
    if (!this.job) return 0;
    const stages = ['received', 'diagnosing', 'repairing', 'testing', 'done'];
    const index = stages.indexOf(this.job.stage);
    return ((index + 1) / stages.length) * 100;
  }

  // Quote Builder
  addService(): void {
    if (!this.newService.name || !this.newService.price) return;
    
    const service: ServiceItem = {
      id: Date.now().toString(),
      name: this.newService.name,
      description: this.newService.description || '',
      duration: this.newService.duration || 60,
      price: this.newService.price,
      quantity: this.newService.quantity || 1,
      total: (this.newService.price || 0) * (this.newService.quantity || 1)
    };
    
    this.quoteForm.services.push(service);
    this.calculateQuote();
    this.resetNewService();
  }

  removeService(index: number): void {
    this.quoteForm.services.splice(index, 1);
    this.calculateQuote();
  }

  addPart(): void {
    if (!this.newPart.name || !this.newPart.price) return;
    
    const part: PartItem = {
      id: Date.now().toString(),
      name: this.newPart.name,
      partNumber: this.newPart.partNumber,
      price: this.newPart.price,
      quantity: this.newPart.quantity || 1,
      total: (this.newPart.price || 0) * (this.newPart.quantity || 1)
    };
    
    this.quoteForm.parts.push(part);
    this.calculateQuote();
    this.resetNewPart();
  }

  removePart(index: number): void {
    this.quoteForm.parts.splice(index, 1);
    this.calculateQuote();
  }

  private calculateQuote(): void {
    this.quoteForm.laborCost = this.quoteForm.services.reduce((sum, s) => sum + s.total, 0);
    this.quoteForm.partsCost = this.quoteForm.parts.reduce((sum, p) => sum + p.total, 0);
  }

  getQuoteSubtotal(): number {
    return this.quoteForm.laborCost + this.quoteForm.partsCost;
  }

  getQuoteTax(): number {
    return this.getQuoteSubtotal() * this.quoteForm.tax;
  }

  getQuoteTotal(): number {
    return this.getQuoteSubtotal() + this.getQuoteTax() - this.quoteForm.discount;
  }

  saveAndSendQuote(): void {
    if (!this.job || this.quoteForm.services.length === 0) {
      alert('Please add at least one service to the quote.');
      return;
    }
    
    const quoteData: Partial<Quote> = {
      services: this.quoteForm.services,
      parts: this.quoteForm.parts,
      laborCost: this.quoteForm.laborCost,
      partsCost: this.quoteForm.partsCost,
      subtotal: this.getQuoteSubtotal(),
      tax: this.getQuoteTax(),
      discount: this.quoteForm.discount,
      total: this.getQuoteTotal(),
      notes: ''
    };
    
    this.bookingService.createQuote(this.job.id, quoteData).subscribe({
      next: (quote) => {
        this.bookingService.sendQuote(quote.id).subscribe({
          next: () => {
            alert('Quote sent successfully!');
            this.loadJobDetails();
          },
          error: (error) => {
            console.error('Error sending quote:', error);
            alert('Failed to send quote.');
          }
        });
      },
      error: (error) => {
        console.error('Error creating quote:', error);
        alert('Failed to create quote.');
      }
    });
  }

  private resetNewService(): void {
    this.newService = {
      name: '',
      description: '',
      duration: 60,
      price: 0,
      quantity: 1
    };
  }

  private resetNewPart(): void {
    this.newPart = {
      name: '',
      partNumber: '',
      price: 0,
      quantity: 1
    };
  }

  // Chat
  sendMessage(): void {
    if (!this.job || !this.newMessage.trim()) return;
    
    const message: Partial<ChatMessage> = {
      senderId: 'workshop-001',
      senderName: 'Workshop',
      senderType: 'workshop',
      message: this.newMessage.trim()
    };
    
    this.bookingService.sendMessage(this.job.id, message).subscribe({
      next: () => {
        this.newMessage = '';
        this.loadJobDetails();
      },
      error: (error) => {
        console.error('Error sending message:', error);
      }
    });
  }

  // Media Upload
  onFileSelected(event: any): void {
    const file = event.target.files[0];
    if (!file || !this.job) return;
    
    this.uploadingMedia = true;
    
    // Mock upload - replace with actual upload logic
    const media: Partial<MediaItem> = {
      type: file.type.startsWith('video') ? 'video' : 'image',
      url: URL.createObjectURL(file),
      caption: '',
      uploadedBy: 'Workshop'
    };
    
    this.bookingService.uploadMedia(this.job.id, media).subscribe({
      next: () => {
        this.uploadingMedia = false;
        this.loadJobDetails();
      },
      error: (error) => {
        console.error('Error uploading media:', error);
        this.uploadingMedia = false;
      }
    });
  }

  // Upsell / Additional Repair
  toggleUpsellForm(): void {
    this.showUpsellForm = !this.showUpsellForm;
  }

  submitAdditionalRepair(): void {
    if (!this.job || !this.upsellForm.title || !this.upsellForm.estimatedCost) {
      alert('Please fill in all required fields.');
      return;
    }
    
    const repair: Partial<AdditionalRepair> = {
      title: this.upsellForm.title,
      description: this.upsellForm.description,
      estimatedCost: this.upsellForm.estimatedCost,
      media: this.upsellForm.media
    };
    
    this.bookingService.suggestAdditionalRepair(this.job.id, repair).subscribe({
      next: () => {
        alert('Additional repair suggested successfully!');
        this.resetUpsellForm();
        this.showUpsellForm = false;
        this.loadJobDetails();
      },
      error: (error) => {
        console.error('Error suggesting additional repair:', error);
        alert('Failed to suggest additional repair.');
      }
    });
  }

  private resetUpsellForm(): void {
    this.upsellForm = {
      title: '',
      description: '',
      estimatedCost: 0,
      media: []
    };
  }

  // Utility Methods
  formatDate(date: Date | string): string {
    const d = new Date(date);
    return d.toLocaleDateString('en-US', {
      month: 'long',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  formatCurrency(amount: number): string {
    return new Intl.NumberFormat('en-EG', {
      style: 'currency',
      currency: 'EGP',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount);
  }

  goBack(): void {
    this.router.navigate(['/workshop/job-board']);
  }
}
