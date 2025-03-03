// Gestion des artistes et des modales
class ArtistManager {
    constructor() {
        this.artists = {};
        this.currentModal = null;
        this.currentPlayer = null;
        this.miniPlayer = document.getElementById('miniPlayer');
        this.init();
        this.loadArtists();
        this.initSpotifyMessageListener();
        this.initMiniPlayer();
    }

    init() {
        // Animation du header au chargement
        const header = document.querySelector('.header');
        if (header) {
            header.classList.add('animate-in');
        }

        // Initialisation des cartes d'artistes
        document.querySelectorAll('.artist-card').forEach(card => {
            card.classList.add('animate-in');
            card.addEventListener('click', () => this.openArtistModal(card.dataset.artistId));
        });

        // Gestion de la fermeture des modales
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && this.currentModal) {
                this.closeCurrentModal();
            }
        });

        // Gestion des clics sur les morceaux
        document.addEventListener('click', async (e) => {
            const trackItem = e.target.closest('.track-item');
            if (!trackItem) return;

            // Empêcher les clics multiples
            if (trackItem.dataset.isPlaying === 'true') return;
            trackItem.dataset.isPlaying = 'true';

            try {
                const modalContent = trackItem.closest('.modal-content');
                const artistName = modalContent.querySelector('.modal-header h2').textContent;
                const trackTitle = trackItem.querySelector('.track-title').textContent;
                const track = this.findTrackByTitle(artistName, trackTitle);
                
                if (track) {
                    this.currentTrack = { track, artistName };
                    await this.showMiniPlayer(track, artistName);
                }
            } catch (error) {
                console.error('Erreur lors de la lecture:', error);
            } finally {
                // Réactiver le clic après un court délai
                setTimeout(() => {
                    trackItem.dataset.isPlaying = 'false';
                }, 1000);
            }
        });

        // Animation au défilement
        this.initScrollAnimation();
    }

    initMiniPlayer() {
        const closeBtn = this.miniPlayer.querySelector('.mini-player-close');
        closeBtn.addEventListener('click', () => {
            this.closeMiniPlayer();
        });
    }

    showMiniPlayer(track, artistName) {
        return new Promise((resolve) => {
            const titleEl = this.miniPlayer.querySelector('.mini-player-title');
            const artistEl = this.miniPlayer.querySelector('.mini-player-artist');
            const playerEl = this.miniPlayer.querySelector('.mini-player-spotify');

            titleEl.textContent = track.title;
            artistEl.textContent = artistName;
            
            const trackId = this.getSpotifyTrackId(track.spotify);
            
            // Créer un gestionnaire unique pour ce lecteur
            const messageHandler = (e) => {
                if (e.origin !== 'https://open.spotify.com') return;
                
                try {
                    const data = JSON.parse(e.data);
                    // Attendre que le lecteur soit réellement prêt
                    if (data.type === 'ready' || data.type === 'initialized') {
                        // Attendre un peu plus longtemps pour s'assurer que le lecteur est complètement initialisé
                        setTimeout(() => {
                            const iframe = playerEl.querySelector('iframe');
                            if (iframe) {
                                // Envoyer la commande de lecture avec le nouveau format
                                iframe.contentWindow.postMessage({
                                    type: 'command',
                                    command: 'play'
                                }, 'https://open.spotify.com');
                                
                                // Nettoyer le gestionnaire d'événements
                                window.removeEventListener('message', messageHandler);
                                resolve();
                            }
                        }, 2000); // Attendre 2 secondes après que l'iframe soit prête
                    }
                } catch (error) {
                    console.error('Erreur lors du traitement du message:', error);
                }
            };

            // Ajouter le gestionnaire d'événements avant de créer l'iframe
            window.addEventListener('message', messageHandler);
            
            // Créer l'iframe avec les paramètres optimisés
            playerEl.innerHTML = `
                <iframe src="https://open.spotify.com/embed/track/${trackId}?utm_source=generator&theme=0&view=transport&autoplay=1"
                    width="100%"
                    height="90"
                    frameBorder="0"
                    allowfullscreen=""
                    allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
                    loading="eager"
                    id="spotify-iframe">
                </iframe>
            `;

            this.miniPlayer.classList.add('active');
        });
    }

    closeMiniPlayer() {
        const playerEl = this.miniPlayer.querySelector('.mini-player-spotify');
        playerEl.innerHTML = '';
        this.miniPlayer.classList.remove('active');
    }

    initSpotifyMessageListener() {
        window.addEventListener('message', (event) => {
            if (event.origin !== 'https://open.spotify.com') return;
            
            try {
                const data = JSON.parse(event.data);
                if (data.type === 'playback_update') {
                    const iframe = event.source.frameElement;
                    if (data.data.isPlaying) {
                        this.handlePlayback(iframe);
                        // Mise à jour du morceau en cours
                        const trackItem = iframe.closest('.track-item');
                        if (trackItem) {
                            const modalContent = trackItem.closest('.modal-content');
                            if (modalContent) {
                                const artistName = modalContent.querySelector('.modal-header h2').textContent;
                                const trackTitle = trackItem.querySelector('.track-title').textContent;
                                const track = this.findTrackByTitle(artistName, trackTitle);
                                if (track) {
                                    this.currentTrack = { track, artistName };
                                }
                            }
                        }
                    }
                }
            } catch (e) {
                console.error('Erreur lors du traitement du message Spotify:', e);
            }
        });
    }

    findTrackByTitle(artistName, trackTitle) {
        const artist = Object.values(this.artists).find(a => a.name === artistName);
        return artist ? artist.tracks.find(t => t.title === trackTitle) : null;
    }

    handlePlayback(currentIframe) {
        document.querySelectorAll('.spotify-player iframe').forEach(iframe => {
            if (iframe !== currentIframe) {
                iframe.contentWindow.postMessage('{"command":"pause"}', '*');
            }
        });
    }

    loadArtists() {
        // Charger les données des artistes depuis data.js
        if (typeof artistsData !== 'undefined') {
            Object.values(artistsData).forEach(artistData => {
                this.artists[artistData.id] = artistData;
                this.updateTrackCount(artistData.id);
                this.populateModal(artistData.id);
            });
        }
    }

    updateTrackCount(artistId) {
        const artist = this.artists[artistId];
        const trackCountEl = document.querySelector(`[data-artist-id="${artistId}"] .track-count`);
        if (trackCountEl && artist) {
            const count = artist.tracks.length;
            trackCountEl.textContent = `${count} production${count > 1 ? 's' : ''}`;
        }
    }

    populateModal(artistId) {
        const artist = this.artists[artistId];
        const modal = document.querySelector(`#modal-${artistId}`);
        if (!modal || !artist) return;

        const tracksList = modal.querySelector('.tracks-list');
        if (tracksList) {
            tracksList.innerHTML = artist.tracks.map(track => this.createTrackItem(track)).join('');
        }
    }

    initScrollAnimation() {
        const observerOptions = {
            threshold: 0.1,
            rootMargin: '0px 0px -50px 0px'
        };

        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    entry.target.classList.add('animate-in');
                    observer.unobserve(entry.target);
                }
            });
        }, observerOptions);

        document.querySelectorAll('.artist-card, .track-item').forEach(el => {
            observer.observe(el);
        });
    }

    openArtistModal(artistId) {
        const modal = document.querySelector(`#modal-${artistId}`);
        if (!modal) return;

        this.currentModal = modal;
        modal.classList.add('active');
        document.body.style.overflow = 'hidden';

        // Animation des éléments dans la modale
        modal.querySelectorAll('.track-item').forEach((item, index) => {
            item.style.animationDelay = `${index * 0.1}s`;
            item.classList.add('animate-in');
        });

        // Gestionnaire de fermeture
        const closeBtn = modal.querySelector('.close-modal');
        if (closeBtn) {
            closeBtn.addEventListener('click', () => this.closeCurrentModal());
        }
    }

    closeCurrentModal() {
        if (!this.currentModal) return;

        // Si un morceau est en cours de lecture, afficher le mini-player
        // seulement s'il n'est pas déjà visible
        if (this.currentTrack && !this.miniPlayer.classList.contains('active')) {
            this.showMiniPlayer(this.currentTrack.track, this.currentTrack.artistName);
        }

        this.currentModal.classList.remove('active');
        document.body.style.overflow = '';
        this.currentModal = null;
    }

    // Méthode pour ajouter un artiste dynamiquement
    addArtist(artistData) {
        const artistCard = this.createArtistCard(artistData);
        const artistModal = this.createArtistModal(artistData);
        
        document.querySelector('.artists-grid').appendChild(artistCard);
        document.body.appendChild(artistModal);
        
        // Réinitialiser les animations
        this.initScrollAnimation();
    }

    createArtistCard(artistData) {
        const card = document.createElement('div');
        card.className = 'artist-card';
        card.dataset.artistId = artistData.id;
        card.innerHTML = `
            <h2>${artistData.name}</h2>
            <span class="track-count">${artistData.tracks.length} productions</span>
        `;
        return card;
    }

    createArtistModal(artistData) {
        const modal = document.createElement('div');
        modal.className = 'artist-modal';
        modal.id = `modal-${artistData.id}`;
        
        modal.innerHTML = `
            <div class="modal-content">
                <div class="modal-header">
                    <h2>${artistData.name}</h2>
                    <button class="close-modal">&times;</button>
                </div>
                <div class="tracks-list">
                    ${artistData.tracks.map(track => this.createTrackItem(track)).join('')}
                </div>
            </div>
        `;
        return modal;
    }

    createTrackItem(track) {
        const trackId = this.getSpotifyTrackId(track.spotify);
        return `
            <div class="track-item" style="background-image: url('${track.image}');">
                <div class="track-header">
                    <div class="track-info">
                        ${track.spotify ? `
                            <button class="play-button track-play-button" data-track-id="${trackId}">
                                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                    <circle cx="12" cy="12" r="12" fill="var(--primary-color)"/>
                                    <path d="M15.5 12L10 15V9L15.5 12Z" fill="white"/>
                                </svg>
                            </button>
                        ` : ''}
                        <h3 class="track-title">${track.title}</h3>
                    </div>
                    <div class="track-links">
                        ${track.youtube ? `
                            <a href="${track.youtube}" class="platform-link youtube" target="_blank" rel="noopener">
                                <span>YouTube</span>
                            </a>
                        ` : ''}
                    </div>
                </div>
            </div>
        `;
    }

    getSpotifyTrackId(spotifyUrl) {
        // Extraire l'ID de la piste depuis l'URL Spotify
        const match = spotifyUrl.match(/track\/([a-zA-Z0-9]+)/);
        return match ? match[1] : '';
    }
}

// Initialisation quand le DOM est chargé
document.addEventListener('DOMContentLoaded', () => {
    window.artistManager = new ArtistManager();
}); 