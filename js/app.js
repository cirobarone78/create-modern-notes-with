/**
 * Main App Module - Application initialization and orchestration
 * Coordinates between storage, UI, notes, search, and theme modules
 */

const NotesApp = (() => {
    // App state
    let state = {
        notes: [],
        filteredNotes: [],
        currentSort: 'updated', // 'updated', 'created', 'title'
        searchQuery: '',
        isInitialized: false
    };

    /**
     * Initialize the application
     */
    const init = () => {
        if (state.isInitialized) {
            console.warn('App already initialized');
            return;
        }

        console.log('🚀 Initializing Notes App...');

        // Check localStorage availability
        if (!StorageModule.isAvailable()) {
            showError('localStorage is not available. Notes will not be saved.');
        }

        // Initialize UI elements
        UIModule.initElements();

        // Load theme
        ThemeModule.init();

        // Load notes from storage
        loadNotes();

        // Setup event listeners
        setupEventListeners();

        // Initialize search
        SearchModule.init();

        // Initialize notes module
        NotesModule.init();

        // Update UI
        updateUI();

        state.isInitialized = true;
        console.log('✅ Notes App initialized successfully');
    };

    /**
     * Load notes from storage
     */
    const loadNotes = () => {
        try {
            state.notes = StorageModule.getNotes();
            state.filteredNotes = [...state.notes];
            sortNotes(state.currentSort);
            console.log(`📝 Loaded ${state.notes.length} notes from storage`);
        } catch (error) {
            console.error('Error loading notes:', error);
            showError('Failed to load notes');
        }
    };

    /**
     * Setup all event listeners
     */
    const setupEventListeners = () => {
        // New note button (main)
        const newNoteBtn = document.getElementById('newNoteBtn');
        if (newNoteBtn) {
            newNoteBtn.addEventListener('click', handleNewNote);
        }

        // New note button (empty state)
        const emptyStateNewNoteBtn = document.getElementById('emptyStateNewNoteBtn');
        if (emptyStateNewNoteBtn) {
            emptyStateNewNoteBtn.addEventListener('click', handleNewNote);
        }

        // Modal close
        const modalClose = document.getElementById('modalClose');
        if (modalClose) {
            modalClose.addEventListener('click', handleCloseModal);
        }

        // Modal overlay click
        const modalOverlay = document.getElementById('modalOverlay');
        if (modalOverlay) {
            modalOverlay.addEventListener('click', handleCloseModal);
        }

        // Save note button
        const saveNoteBtn = document.getElementById('saveNoteBtn');
        if (saveNoteBtn) {
            saveNoteBtn.addEventListener('click', handleSaveNote);
        }

        // Delete note button
        const deleteNoteBtn = document.getElementById('deleteNoteBtn');
        if (deleteNoteBtn) {
            deleteNoteBtn.addEventListener('click', handleDeleteNote);
        }

        // Cancel button
        const cancelNoteBtn = document.getElementById('cancelNoteBtn');
        if (cancelNoteBtn) {
            cancelNoteBtn.addEventListener('click', handleCloseModal);
        }

        // Sort buttons
        const filterBtns = document.querySelectorAll('.filter-btn');
        filterBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                const sortType = btn.dataset.sort;
                handleSort(sortType);
            });
        });

        // View toggle buttons
        const viewBtns = document.querySelectorAll('.view-btn');
        viewBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                const view = btn.dataset.view;
                UIModule.setViewMode(view);
            });
        });

        // Export button
        const exportBtn = document.getElementById('exportBtn');
        if (exportBtn) {
            exportBtn.addEventListener('click', handleExport);
        }

        // Mobile menu toggle
        const mobileMenuToggle = document.getElementById('mobileMenuToggle');
        if (mobileMenuToggle) {
            mobileMenuToggle.addEventListener('click', UIModule.toggleMobileSidebar);
        }

        // Color picker
        const colorOptions = document.querySelectorAll('.color-option');
        colorOptions.forEach(option => {
            option.addEventListener('click', () => {
                const color = option.dataset.color;
                const noteColorInput = document.getElementById('noteColor');
                if (noteColorInput) {
                    noteColorInput.value = color;
                    colorOptions.forEach(opt => opt.classList.remove('active'));
                    option.classList.add('active');
                }
            });
        });

        // Keyboard shortcuts
        document.addEventListener('keydown', handleKeyboardShortcuts);

        // Custom events from other modules
        document.addEventListener('editNote', (e) => {
            handleEditNote(e.detail.noteId);
        });

        document.addEventListener('deleteNote', (e) => {
            handleDeleteNoteConfirm(e.detail.noteId);
        });

        document.addEventListener('searchUpdated', (e) => {
            handleSearch(e.detail.query);
        });

        // Close mobile sidebar when clicking on note (mobile only)
        if (window.innerWidth < 768) {
            document.addEventListener('editNote', () => {
                UIModule.closeMobileSidebar();
            });
        }

        // Handle window resize
        window.addEventListener('resize', handleResize);
    };

    /**
     * Handle new note creation
     */
    const handleNewNote = () => {
        UIModule.openModal();
    };

    /**
     * Handle edit note
     * @param {number} noteId
     */
    const handleEditNote = (noteId) => {
        const note = state.notes.find(n => n.id === noteId);
        if (note) {
            UIModule.openModal(note);
        } else {
            UIModule.showToast('Note not found', 'error');
        }
    };

    /**
     * Handle save note
     */
    const handleSaveNote = async () => {
        const noteData = UIModule.getModalNoteData();
        const editingId = UIModule.getCurrentEditingNoteId();

        // Validate
        if (!noteData.title.trim()) {
            UIModule.showToast('Please enter a title', 'error');
            return;
        }

        try {
            if (editingId) {
                // Update existing note
                const updatedNote = StorageModule.updateNote(editingId, noteData);
                if (updatedNote) {
                    // Update in state
                    const index = state.notes.findIndex(n => n.id === editingId);
                    if (index !== -1) {
                        state.notes[index] = updatedNote;
                    }
                    UIModule.showToast('Note updated successfully', 'success');
                } else {
                    throw new Error('Failed to update note');
                }
            } else {
                // Create new note
                const newNote = StorageModule.createNote(noteData);
                if (newNote) {
                    state.notes.unshift(newNote);
                    UIModule.showToast('Note created successfully', 'success');
                } else {
                    throw new Error('Failed to create note');
                }
            }

            // Refresh UI
            applyCurrentFilters();
            updateUI();
            UIModule.closeModal();
        } catch (error) {
            console.error('Error saving note:', error);
            UIModule.showToast('Failed to save note', 'error');
        }
    };

    /**
     * Handle delete note with confirmation
     * @param {number} noteId
     */
    const handleDeleteNoteConfirm = async (noteId) => {
        const confirmed = await UIModule.showConfirm('Are you sure you want to delete this note?');
        
        if (confirmed) {
            handleDeleteNoteById(noteId);
        }
    };

    /**
     * Handle delete note (from modal)
     */
    const handleDeleteNote = async () => {
        const noteId = UIModule.getCurrentEditingNoteId();
        
        if (!noteId) return;
        
        const confirmed = await UIModule.showConfirm('Are you sure you want to delete this note?');
        
        if (confirmed) {
            handleDeleteNoteById(noteId);
            UIModule.closeModal();
        }
    };

    /**
     * Delete note by ID
     * @param {number} noteId
     */
    const handleDeleteNoteById = (noteId) => {
        try {
            const success = StorageModule.deleteNote(noteId);
            
            if (success) {
                // Remove from state
                state.notes = state.notes.filter(n => n.id !== noteId);
                state.filteredNotes = state.filteredNotes.filter(n => n.id !== noteId);
                
                UIModule.showToast('Note deleted successfully', 'success');
                updateUI();
            } else {
                throw new Error('Failed to delete note');
            }
        } catch (error) {
            console.error('Error deleting note:', error);
            UIModule.showToast('Failed to delete note', 'error');
        }
    };

    /**
     * Handle close modal
     */
    const handleCloseModal = () => {
        UIModule.closeModal();
    };

    /**
     * Handle sort
     * @param {string} sortType
     */
    const handleSort = (sortType) => {
        state.currentSort = sortType;
        
        // Update active button
        const filterBtns = document.querySelectorAll('.filter-btn');
        filterBtns.forEach(btn => {
            const isActive = btn.dataset.sort === sortType;
            btn.classList.toggle('active', isActive);
            btn.setAttribute('aria-checked', isActive);
        });
        
        sortNotes(sortType);
        updateUI();
    };

    /**
     * Sort notes
     * @param {string} sortType
     */
    const sortNotes = (sortType) => {
        switch (sortType) {
            case 'updated':
                state.filteredNotes.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
                break;
            case 'created':
                state.filteredNotes.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
                break;
            case 'title':
                state.filteredNotes.sort((a, b) => a.title.localeCompare(b.title));
                break;
        }
    };

    /**
     * Handle search
     * @param {string} query
     */
    const handleSearch = (query) => {
        state.searchQuery = query;
        applyCurrentFilters();
        updateUI();
    };

    /**
     * Apply current filters (search + sort)
     */
    const applyCurrentFilters = () => {
        if (state.searchQuery) {
            state.filteredNotes = SearchModule.searchNotes(state.notes, state.searchQuery);
        } else {
            state.filteredNotes = [...state.notes];
        }
        
        sortNotes(state.currentSort);
    };

    /**
     * Handle export
     */
    const handleExport = () => {
        try {
            const jsonData = StorageModule.exportNotes();
            const blob = new Blob([jsonData], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            
            const a = document.createElement('a');
            a.href = url;
            a.download = `notes-backup-${new Date().toISOString().split('T')[0]}.json`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
            
            UIModule.showToast('Notes exported successfully', 'success');
        } catch (error) {
            console.error('Error exporting notes:', error);
            UIModule.showToast('Failed to export notes', 'error');
        }
    };

    /**
     * Handle keyboard shortcuts
     * @param {KeyboardEvent} e
     */
    const handleKeyboardShortcuts = (e) => {
        // Ctrl/Cmd + N: New note
        if ((e.ctrlKey || e.metaKey) && e.key === 'n') {
            e.preventDefault();
            handleNewNote();
        }
        
        // Escape: Close modal
        if (e.key === 'Escape') {
            const modal = document.getElementById('noteModal');
            if (modal && modal.style.display === 'flex') {
                handleCloseModal();
            }
        }
        
        // Ctrl/Cmd + S: Save note (when modal is open)
        if ((e.ctrlKey || e.metaKey) && e.key === 's') {
            const modal = document.getElementById('noteModal');
            if (modal && modal.style.display === 'flex') {
                e.preventDefault();
                handleSaveNote();
            }
        }
    };

    /**
     * Handle window resize
     */
    const handleResize = () => {
        // Close mobile sidebar on desktop
        if (window.innerWidth >= 768) {
            UIModule.closeMobileSidebar();
        }
    };

    /**
     * Update UI with current state
     */
    const updateUI = () => {
        // Get latest note for stats
        const latestNote = state.notes.length > 0 ? state.notes[0] : null;
        
        // Update stats
        UIModule.updateStats(
            state.notes.length,
            latestNote ? latestNote.updatedAt : null
        );
        
        // Render notes
        if (state.filteredNotes.length === 0 && state.notes.length === 0) {
            UIModule.showEmptyState();
        } else {
            const title = state.searchQuery 
                ? `Search Results (${state.filteredNotes.length})` 
                : 'All Notes';
            UIModule.renderNotes(state.filteredNotes, title);
        }
    };

    /**
     * Show error message
     * @param {string} message
     */
    const showError = (message) => {
        console.error(message);
        UIModule.showToast(message, 'error');
    };

    /**
     * Get current app state (for debugging)
     * @returns {Object}
     */
    const getState = () => {
        return { ...state };
    };

    // Public API
    return {
        init,
        getState
    };
})();

// Initialize app when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', NotesApp.init);
} else {
    NotesApp.init();
}