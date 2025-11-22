import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule, ActivatedRoute } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { BookingService } from '../../services/booking.service';
import { Job, JobStatus } from '../../models/booking.model';

@Component({
  selector: 'app-job-board',
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule],
  templateUrl: './job-board.component.html',
  styleUrls: ['./job-board.component.css']
})
export class JobBoardComponent implements OnInit {
  selectedTab: JobStatus = 'new';
  viewMode: 'kanban' | 'list' = 'kanban';
  
  jobs: Job[] = [];
  newJobs: Job[] = [];
  upcomingJobs: Job[] = [];
  inProgressJobs: Job[] = [];
  readyJobs: Job[] = [];
  completedJobs: Job[] = [];
  
  searchQuery: string = '';
  filterUrgency: string = 'all';
  
  draggedJob: Job | null = null;

  constructor(
    private bookingService: BookingService,
    private router: Router,
    private route: ActivatedRoute
  ) {}

  ngOnInit(): void {
    // Check for tab query param
    this.route.queryParams.subscribe(params => {
      if (params['tab']) {
        this.selectedTab = params['tab'] as JobStatus;
      }
    });
    
    this.loadJobs();
  }

  private loadJobs(): void {
    this.bookingService.getJobs().subscribe({
      next: (jobs) => {
        this.jobs = jobs;
        this.categorizeJobs();
      },
      error: (error) => {
        console.error('Error loading jobs:', error);
      }
    });
  }

  private categorizeJobs(): void {
    this.newJobs = this.jobs.filter(j => j.status === 'new');
    this.upcomingJobs = this.jobs.filter(j => j.status === 'upcoming');
    this.inProgressJobs = this.jobs.filter(j => j.status === 'in-progress');
    this.readyJobs = this.jobs.filter(j => j.status === 'ready');
    this.completedJobs = this.jobs.filter(j => j.status === 'completed');
  }

  switchTab(tab: JobStatus): void {
    this.selectedTab = tab;
  }

  toggleViewMode(): void {
    this.viewMode = this.viewMode === 'kanban' ? 'list' : 'kanban';
  }

  getJobsByStatus(status: JobStatus): Job[] {
    switch (status) {
      case 'new': return this.newJobs;
      case 'upcoming': return this.upcomingJobs;
      case 'in-progress': return this.inProgressJobs;
      case 'ready': return this.readyJobs;
      case 'completed': return this.completedJobs;
      default: return [];
    }
  }

  getStatusLabel(status: JobStatus): string {
    const labels: Record<JobStatus, string> = {
      'new': 'New Requests',
      'upcoming': 'Upcoming',
      'in-progress': 'In Progress',
      'ready': 'Ready for Pickup',
      'completed': 'Completed',
      'cancelled': 'Cancelled'
    };
    return labels[status];
  }

  getStatusCount(status: JobStatus): number {
    return this.getJobsByStatus(status).length;
  }

  getUrgencyClass(urgency: string): string {
    const classes: Record<string, string> = {
      'urgent': 'urgency-urgent',
      'high': 'urgency-high',
      'normal': 'urgency-normal',
      'low': 'urgency-low'
    };
    return classes[urgency] || 'urgency-normal';
  }

  getUrgencyLabel(urgency: string): string {
    return urgency.charAt(0).toUpperCase() + urgency.slice(1);
  }

  viewJobDetails(jobId: string): void {
    this.router.navigate(['/workshop/job', jobId]);
  }

  // Drag and Drop functionality
  onDragStart(event: DragEvent, job: Job): void {
    this.draggedJob = job;
    if (event.dataTransfer) {
      event.dataTransfer.effectAllowed = 'move';
      event.dataTransfer.setData('text/html', event.target as any);
    }
  }

  onDragOver(event: DragEvent): void {
    event.preventDefault();
    if (event.dataTransfer) {
      event.dataTransfer.dropEffect = 'move';
    }
  }

  onDrop(event: DragEvent, newStatus: JobStatus): void {
    event.preventDefault();
    
    if (this.draggedJob && this.draggedJob.status !== newStatus) {
      this.updateJobStatus(this.draggedJob.id, newStatus);
    }
    
    this.draggedJob = null;
  }

  onDragEnd(): void {
    this.draggedJob = null;
  }

  updateJobStatus(jobId: string, newStatus: JobStatus): void {
    this.bookingService.updateJobStatus(jobId, newStatus).subscribe({
      next: () => {
        this.loadJobs();
        // TODO: Show success notification
        console.log('Job status updated successfully');
      },
      error: (error) => {
        console.error('Error updating job status:', error);
        // TODO: Show error notification
      }
    });
  }

  formatDate(date: Date | string): string {
    const d = new Date(date);
    return d.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  getStageProgress(stage: string): number {
    const stages = ['received', 'diagnosing', 'repairing', 'testing', 'done'];
    const index = stages.indexOf(stage);
    return ((index + 1) / stages.length) * 100;
  }

  getStageLabel(stage: string): string {
    const labels: Record<string, string> = {
      'received': 'Received',
      'diagnosing': 'Diagnosing',
      'repairing': 'Repairing',
      'testing': 'Testing',
      'done': 'Done'
    };
    return labels[stage] || stage;
  }
}
