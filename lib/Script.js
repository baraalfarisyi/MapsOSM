let map;
let markers = [];
let apiData = null; 
let markerObjects = {};
let batchSize = 500;
let currentBatchIndex = 0;
let centerPosition = null;
let colorCache = {};
let markersCluster = L.markerClusterGroup(); 
let polylineObjects = {};
let layerControl; 
let poleTypeLayers = {};
let geocoderMarker = null;

// Inisialisasi peta dengan Leaflet
function initMap() {
    if (map !== undefined) {
        map.remove(); // Menghapus peta jika sudah ada
    }

    map = L.map('map', {
        preferCanvas: true,
        zoomControl: false,
        maxZoom: 22 // Set maxZoom agar pengguna bisa melakukan zoom in lebih dekat
    }).setView([-6.200000, 106.816666], 10); // Jakarta sebagai pusat

    const osmLayer = L.tileLayer('https://api.maptiler.com/maps/basic-v2/{z}/{x}/{y}.png?key=rl4a2JtUGukoJ61IcWQt', {
        attribution: '&copy; <a href="https://www.maptiler.com/">MapTiler</a>',
        maxZoom: 22 // MapTiler Basic mendukung zoom hingga level 22
    }).addTo(map);

    const satelliteLayer = L.tileLayer('https://api.maptiler.com/maps/hybrid/{z}/{x}/{y}.jpg?key=rl4a2JtUGukoJ61IcWQt', {
        attribution: '&copy; <a href="https://www.maptiler.com/">MapTiler</a>',
        maxZoom: 22
    });

    const streetsLayer = L.tileLayer('https://api.maptiler.com/maps/streets-v2/{z}/{x}/{y}.png?key=rl4a2JtUGukoJ61IcWQt', {
        attribution: '&copy; <a href="https://www.maptiler.com/">MapTiler</a>',
        maxZoom: 22
    });

    const outdoorLayer = L.tileLayer('https://api.maptiler.com/maps/outdoor-v2/{z}/{x}/{y}.png?key=rl4a2JtUGukoJ61IcWQt', {
        attribution: '&copy; <a href="https://www.maptiler.com/">MapTiler</a>',
        maxZoom: 22
    });

    const riverLayer = L.maptilerLayer({
        apiKey: 'rl4a2JtUGukoJ61IcWQt',
        style: "9c0b49cb-2c8c-44c0-9642-78a1fb1703a2",
    });

    const trainLayer = L.maptilerLayer({
        apiKey: 'rl4a2JtUGukoJ61IcWQt',
        style: "132252fc-cb20-4464-b212-6b15ace84c5c",
    });

    // Kontrol layer hanya dengan base layers dan overlay markers
    const baseLayers = {
        "Basic Map": osmLayer,
        "Satellite Map": satelliteLayer,
        "Transport Map": streetsLayer,
        "River Map": riverLayer,
        "Train Map": trainLayer,
        "Outdoor Map": outdoorLayer
    };

    // Tambahkan Geocoder
    const geocoder = L.Control.geocoder({
        defaultMarkGeocode: false,
        collapsed: false // Ensure the search box does not collapse
    })
    .on('markgeocode', function(e) {
        if (geocoderMarker) {
            map.removeLayer(geocoderMarker); // Menghapus marker sebelumnya jika ada
        }
        geocoderMarker = L.marker(e.geocode.center).addTo(map)
            .bindPopup(e.geocode.name)
            .openPopup();
        map.setView(e.geocode.center, 10);
        // Tambahkan tombol close setelah marker ditambahkan
        addCloseButton().setPosition('topleft');
    })
    .addTo(map).setPosition('topleft');

    // Create layer control for base layers
    layerControl = L.control.layers(baseLayers, null, {
        collapsed: true
    }).addTo(map);

    // Add zoom control at the top-right
    L.control.zoom({
        position: 'topright'
    }).addTo(map);

    // Add scale control to the map
    L.control.scale().addTo(map);

    // Marker cluster initialization
    map.addLayer(markersCluster);  // Add markers cluster to the map
}

// Fungsi untuk menambahkan tombol close
function addCloseButton() {
    var closeButton = document.createElement('button');
    closeButton.classList.add('geocoder-close-btn');
    closeButton.innerHTML = 'X';
    closeButton.onclick = function() {
        removeMarker(); // Panggil fungsi untuk menghapus marker
    };

    // Hapus tombol lama jika sudah ada, lalu tambahkan yang baru
    var existingButton = document.querySelector('.geocoder-close-btn');
    if (existingButton) {
        existingButton.remove();
    }

    document.body.appendChild(closeButton);
}

// Fungsi untuk menghapus marker
function removeMarker() {
    if (geocoderMarker) {
        map.removeLayer(geocoderMarker); // Hapus marker dari peta
        geocoderMarker = null; // Reset variabel marker

        // Hapus tombol close setelah marker dihapus
        var closeButton = document.querySelector('.geocoder-close-btn');
        if (closeButton) {
            closeButton.remove();
        }
    }
}

// Mengambil data dari API dan memulai proses secara otomatis
function fetchDataFromAPI() {
    const apiUrl = 'http://10.8.0.104:1880/fodata'; // Ganti dengan URL API yang sesuai

    // Panggil API untuk mendapatkan data
    fetch(apiUrl)
        .then(response => response.json())
        .then(data => {
            apiData = data; // Simpan data dari API
            console.log("Data received from API:", apiData); // Debug: Lihat data dari API
            console.log('Data fetched from API, starting batch processing');
            clearMarkers(); 
            currentBatchIndex = 0;
            showLoading(true); // Tampilkan loading popup
            processBatch();  // Langsung mulai proses batch
        })
        .catch(error => console.error('Error fetching data:', error));
}

function addMarkerWithInfo(lat, lng, name, info, id, poleType) {
    const marker = L.marker([lat, lng]);

    // Simpan marker dengan pop-up, tetapi jangan langsung ditambahkan ke peta
    marker.bindPopup(`<div><strong>${name}</strong><br>${info}</div>`);

    if (!markerObjects[id]) {
        markerObjects[id] = [];
    }
    markerObjects[id].push(marker);

    // Jangan tambahkan marker ke cluster atau peta saat ini
    // Marker akan ditambahkan ke markersCluster hanya saat polyline diklik

    // Simpan koordinat marker untuk polyline berdasarkan AssignmentTaggingID
    if (!polylineObjects[id]) {
        polylineObjects[id] = [];
    }
    polylineObjects[id].push([lat, lng]); // Simpan koordinat marker

    // Tambahkan marker ke poleTypeLayer yang sesuai
    if (!poleTypeLayers[poleType]) {
        poleTypeLayers[poleType] = L.layerGroup(); // Buat layerGroup baru jika belum ada
    }
    poleTypeLayers[poleType].addLayer(marker);
}


// Fungsi untuk membersihkan semua marker dari peta
function clearMarkers() {
    for (const id in markerObjects) {
        markerObjects[id].forEach(marker => map.removeLayer(marker));
    }
    markerObjects = {};
}

function addPolylines() {
    for (const id in polylineObjects) {
        const coordinates = polylineObjects[id];
        let totalDistanceKm = 0; // Variabel untuk menyimpan total jarak dalam km

        // Buat polyline hanya jika ada lebih dari 1 koordinat
        if (coordinates.length > 1) {
            // Loop untuk membuat polyline antar dua titik
            for (let i = 0; i < coordinates.length - 1; i++) {
                const latlng1 = L.latLng(coordinates[i]);
                const latlng2 = L.latLng(coordinates[i + 1]);
                const segmentDistance = latlng1.distanceTo(latlng2);  // Menghitung jarak antara dua titik dalam meter
            
                let segmentDistanceText = ''; // Variabel untuk menyimpan teks jarak segmen
            
                // Selalu tambahkan jarak ke totalDistanceKm, konversi ke km (meter ke kilometer)
                totalDistanceKm += segmentDistance / 1000;
            
                // Cek apakah jarak segmen lebih kecil dari 1000 meter
                if (segmentDistance < 1000) {
                    segmentDistanceText = `${segmentDistance.toFixed(2)} m`; // Tampilkan dalam meter jika di bawah 1 km
                } else {
                    const segmentDistanceKm = (segmentDistance / 1000).toFixed(2); // Konversi ke kilometer
                    segmentDistanceText = `${segmentDistanceKm} km`; // Tampilkan dalam kilometer jika di atas 1 km
                }
            
                // Buat polyline untuk segmen ini
                const segmentPolyline = L.polyline([latlng1, latlng2], {
                    color: getColorForID(id),  // Warna polyline berdasarkan AssignmentTaggingID
                    weight: 5,
                    opacity: 1.0
                }).addTo(map);
            
                // Event listener untuk polyline segmen
                segmentPolyline.on('click', function () {
                    // Tampilkan jarak antar dua titik di popup saat segmen polyline diklik
                    segmentPolyline.bindPopup(`<div>Distance between Point ${i + 1} and Point ${i + 2}: ${segmentDistanceText}</div>`).openPopup();
            
                    // Event listener tambahan untuk menampilkan atau menyembunyikan marker terkait
                    if (segmentPolyline.isMarkersVisible) {
                        // Sembunyikan marker
                        markerObjects[id].forEach(marker => {
                            markersCluster.removeLayer(marker); // Hapus marker dari cluster
                        });
                        segmentPolyline.isMarkersVisible = false;
                        console.log(`Markers for AssignmentTaggingID: ${id} hidden`);
                    } else {
                        // Tampilkan marker
                        markerObjects[id].forEach(marker => {
                            markersCluster.addLayer(marker); // Tambahkan marker ke cluster
                        });
                        segmentPolyline.isMarkersVisible = true;
                        map.addLayer(markersCluster); // Pastikan cluster ditambahkan ke peta
                        console.log(`Markers for AssignmentTaggingID: ${id} shown`);
            
                        // Hanya panggil fitBounds jika marker baru pertama kali ditampilkan
                        if (!segmentPolyline.boundsFitted) {
                            map.fitBounds(markersCluster.getBounds()); // Sesuaikan zoom dengan marker di cluster
                            segmentPolyline.boundsFitted = true; // Tandai bahwa fitBounds sudah dipanggil
                        }
                    }
                });
            
                console.log(`Added segment polyline for AssignmentTaggingID: ${id} between Point ${i + 1} and Point ${i + 2}, distance: ${segmentDistanceText}`);
            }
        }
    }
}

// Fungsi untuk mendapatkan atau menghasilkan warna untuk setiap ID
function getColorForID(id) {
    if (!colorCache[id]) {
        colorCache[id] = getRandomColor(); // Random warna jika belum ada
    }
    return colorCache[id];
}

// Fungsi untuk menghasilkan warna acak
function getRandomColor() {
    const letters = '0123456789ABCDEF';
    let color = '#';
    for (let i = 0; i < 6; i++) {
        color += letters[Math.floor(Math.random() * 16)];
    }
    return color;
}

// Fungsi untuk memperbarui kontrol layer setelah semua marker di-load
function updateLayerControl() {
    const overlays = {};

    // Tambahkan setiap PoleType ke overlays
    for (const poleType in poleTypeLayers) {
        overlays[`PoleType: ${poleType}`] = poleTypeLayers[poleType]; // Masukkan layerGroup berdasarkan poleType
    }

    // Perbarui kontrol layer hanya dengan overlays tanpa baseLayers
    layerControl = L.control.layers(null, overlays, {
        collapsed: true // Membuka kontrol lapisan secara default
    }).addTo(map);

    // Menambahkan ID khusus untuk kontrol layer bagian bawah
    const bottomControl = layerControl.getContainer();
    bottomControl.setAttribute('id', 'bottomLayerControl'); // Menambahkan ID "bottomLayerControl"

    // Mengganti ikon kontrol layer bagian bawah dengan JavaScript
    const bottomControlToggle = document.querySelector('#bottomLayerControl .leaflet-control-layers-toggle');
    if (bottomControlToggle) {
        bottomControlToggle.style.backgroundImage = "url('images/electric-pole-icon.png')";
        bottomControlToggle.style.backgroundSize = "30px 30px";
        bottomControlToggle.style.width = "36px";
        bottomControlToggle.style.height = "36px";
    }

    // Tambahkan event listener untuk mendeteksi uncheck dan check pada layer
    map.on('overlayadd', function(e) {
        console.log(`Layer ${e.name} added`);
    });

    map.on('overlayremove', function(e) {
        console.log(`Layer ${e.name} removed`);
    });
}

function processBatch() {
    if (!apiData || apiData.length === 0) { // Pastikan apiData sudah ada dan tidak kosong
        console.error('No data to process.');
        return;
    }

    const bounds = L.latLngBounds(); // Inisialisasi bounds baru
    const endIndex = Math.min(currentBatchIndex + batchSize, apiData.length); // Gunakan apiData
    centerPosition = null;

    for (let i = currentBatchIndex; i < endIndex; i++) {
        const row = apiData[i]; // Gunakan apiData
        if (row.Latitude && row.Longitude && row.AssignmentTaggingID) { // Properti yang sesuai dengan data
            const lat = parseFloat(row.Latitude); // Huruf kapital sesuai data API
            const lng = parseFloat(row.Longitude); // Huruf kapital sesuai data API
            const id = row.AssignmentTaggingID;
            const poleType = row.PoleType || "Unknown"; // Ambil poleType atau beri label 'Unknown' jika kosong
            const info = `AssignmentTaggingID: ${id}<br>TagNameCode: ${row.TagNameCode}<br>TaggingAnswerID: ${row.TaggingAnswerID}<br>PoleType: ${poleType}`;

            console.log(`Adding marker for ${id} at (${lat}, ${lng})`); // Debug: Lihat marker yang ditambahkan

            addMarkerWithInfo(lat, lng, row.TagNameCode, info, id, poleType);

            // Perluas bounds untuk mencakup semua marker
            bounds.extend([lat, lng]);

            if (!centerPosition) {
                centerPosition = { lat: lat, lng: lng };
            }
        } else {
            console.warn("Invalid data at index:", i, row); // Log jika ada data tidak valid
        }
    }

    // Center peta hanya di batch pertama
    if (centerPosition && currentBatchIndex === 0) {
        console.log(`Centering map to (${centerPosition.lat}, ${centerPosition.lng})`);
        map.setView([centerPosition.lat, centerPosition.lng], 10); // Set view ke posisi tengah
    }

    currentBatchIndex = endIndex;

    if (currentBatchIndex < apiData.length) { // Lanjutkan proses batch jika belum selesai
        setTimeout(processBatch, 100); // Jeda kecil sebelum batch berikutnya
    } else {
        console.log('All batches processed, adding polylines');
        addPolylines();  // Tambahkan polyline setelah semua batch selesai
        updateLayerControl(); // Perbarui kontrol layer setelah batch selesai

        // Zoom peta agar mencakup semua marker yang ada
        if (bounds.isValid()) {
            map.fitBounds(bounds); // Fit peta dengan bounds dari semua marker
        } else {
            console.warn('Bounds are not valid.');
        }

        showLoading(false); // Sembunyikan loading popup
    }
}

// Fungsi untuk menampilkan atau menyembunyikan popup loading
function showLoading(show) {
    const loadingPopup = document.getElementById('loading-popup');
    if (loadingPopup) {
        loadingPopup.style.display = show ? 'flex' : 'none';
        console.log(show ? 'Showing loading popup' : 'Hiding loading popup');
    }
}

// Saat DOM siap, jalankan fungsi ini
document.addEventListener('DOMContentLoaded', function () {
    showLoading(false); // Sembunyikan loading di awal
    initMap(); // Inisialisasi peta
    fetchDataFromAPI(); // Ambil data dari API saat halaman dimuat

    // Event listener untuk tombol "Remove Marker"
    document.getElementById('remove-marker-btn').addEventListener('click', function() {
        if (geocoderMarker) {
            map.removeLayer(geocoderMarker);  // Hapus marker dari peta
            geocoderMarker = null;  // Set marker kembali ke null
        }
        // Sembunyikan tombol setelah marker dihapus
        document.getElementById('remove-marker-btn').style.display = 'none';
    });

});