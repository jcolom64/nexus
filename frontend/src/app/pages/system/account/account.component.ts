import { Component, OnInit } from '@angular/core';

interface User {
  username: string;
  type: 'Local' | 'SSO';
  created: string;
  lastUpdated: string;
}

@Component({
  selector: 'ngx-account',
  template: `
    <div class="account-container">
      <div class="header-container">
        <h6>Account Management</h6>
        <button nbButton status="primary" size="small" (click)="addNewUser()">
          <nb-icon icon="plus-outline"></nb-icon>
          Add New User
        </button>
      </div>
      
      <div class="table-info">
        <p class="description">Your users are shown below. Click Edit to view and modify their associated credentials.</p>
        <div class="table-controls">
          <label for="itemsPerPage">Show:</label>
          <nb-select [(selected)]="itemsPerPage" (selectedChange)="onItemsPerPageChange()" size="small" id="itemsPerPage">
            <nb-option value="5">5</nb-option>
            <nb-option value="10">10</nb-option>
            <nb-option value="25">25</nb-option>
            <nb-option value="50">50</nb-option>
            <nb-option value="100">100</nb-option>
          </nb-select>
          <span>entries</span>
        </div>
      </div>

      <table class="table">
        <thead>
          <tr>
            <th>Username</th>
            <th>Type</th>
            <th>Created</th>
            <th>Last Updated</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          <tr *ngFor="let user of paginatedUsers">
            <td>{{ user.username }}</td>
            <td>
              <nb-badge [status]="user.type === 'Local' ? 'info' : 'success'">
                {{ user.type }}
              </nb-badge>
            </td>
            <td>{{ user.created }}</td>
            <td>{{ user.lastUpdated }}</td>
            <td>
              <div class="action-buttons">
                <button nbButton ghost status="primary" size="tiny" (click)="editUser(user)" title="Edit">
                  <nb-icon icon="edit-outline"></nb-icon>
                </button>
                <button nbButton ghost status="danger" size="tiny" (click)="deleteUser(user)" title="Delete">
                  <nb-icon icon="trash-2-outline"></nb-icon>
                </button>
                <button nbButton ghost status="warning" size="tiny" (click)="manageApiKey(user)" title="API Key">
                  <nb-icon icon="key-outline"></nb-icon>
                </button>
              </div>
            </td>
          </tr>
        </tbody>
      </table>

      <div class="pagination-info" *ngIf="users.length > 0">
        <p>Showing {{ startIndex + 1 }} to {{ endIndex }} of {{ users.length }} Users</p>
        <div class="pagination-controls" *ngIf="totalPages > 1">
          <button nbButton ghost status="basic" size="small" (click)="previousPage()" [disabled]="currentPage === 1">
            <nb-icon icon="arrow-left-outline"></nb-icon>
            Previous
          </button>
          <span class="page-info">Page {{ currentPage }} of {{ totalPages }}</span>
          <button nbButton ghost status="basic" size="small" (click)="nextPage()" [disabled]="currentPage === totalPages">
            Next
            <nb-icon icon="arrow-right-outline"></nb-icon>
          </button>
        </div>
      </div>

      <div class="no-data" *ngIf="users.length === 0">
        <p>No users found. Click "Add New User" to get started.</p>
      </div>
    </div>
  `,
  styleUrls: ['./account.component.scss']
})
export class AccountComponent implements OnInit {
  users: User[] = [
    {
      username: 'admin',
      type: 'Local',
      created: '2026-01-15 10:30:00',
      lastUpdated: '2026-04-30 14:25:00'
    },
    {
      username: 'john.doe@company.com',
      type: 'SSO',
      created: '2026-02-20 09:15:00',
      lastUpdated: '2026-04-28 16:45:00'
    },
    {
      username: 'jane.smith',
      type: 'Local',
      created: '2026-03-10 11:00:00',
      lastUpdated: '2026-04-29 08:30:00'
    }
  ];

  itemsPerPage: string = '10';
  currentPage: number = 1;
  paginatedUsers: User[] = [];
  totalPages: number = 1;
  startIndex: number = 0;
  endIndex: number = 0;

  ngOnInit() {
    this.updatePagination();
  }

  onItemsPerPageChange() {
    this.currentPage = 1;
    this.updatePagination();
  }

  updatePagination() {
    const itemsCount = parseInt(this.itemsPerPage);
    this.totalPages = Math.ceil(this.users.length / itemsCount);
    this.startIndex = (this.currentPage - 1) * itemsCount;
    this.endIndex = Math.min(this.startIndex + itemsCount, this.users.length);
    this.paginatedUsers = this.users.slice(this.startIndex, this.endIndex);
  }

  previousPage() {
    if (this.currentPage > 1) {
      this.currentPage--;
      this.updatePagination();
    }
  }

  nextPage() {
    if (this.currentPage < this.totalPages) {
      this.currentPage++;
      this.updatePagination();
    }
  }

  addNewUser() {
    console.log('Add new user clicked');
    // TODO: Implement add user modal/form
  }

  editUser(user: User) {
    console.log('Edit user:', user);
    // TODO: Implement edit user modal/form
  }

  deleteUser(user: User) {
    console.log('Delete user:', user);
    // TODO: Implement delete confirmation modal
  }

  manageApiKey(user: User) {
    console.log('Manage API key for:', user);
    // TODO: Implement API key management modal
  }
}