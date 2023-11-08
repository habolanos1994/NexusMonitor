document.addEventListener('DOMContentLoaded', function() {
    fetchStatus();

    const restartAllButton = document.getElementById("restartAll");
    restartAllButton.addEventListener("click", restartAllWorkers);
});

function fetchStatus() {
    fetch('/workerStatus')
        .then(response => response.json())
        .then(data => {
            const tableBody = document.getElementById('workerTable');
            tableBody.innerHTML = '';

            for (let item of data) {
                const row = tableBody.insertRow();
                const nameCell = row.insertCell(0);
                const statusCell = row.insertCell(1);
                const actionCell = row.insertCell(2);

                nameCell.textContent = item.serviceName;
                statusCell.textContent = item.status;

                const restartButton = document.createElement('button');
                restartButton.textContent = 'Restart';
                restartButton.addEventListener('click', () => restartWorker(item.serviceName));
                actionCell.appendChild(restartButton);
            }
        });
}

function restartWorker(workerName) {
    fetch('/restartWorker', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ serviceName: workerName })
    })
    .then(response => {
        if (response.ok) {
            alert(`Worker ${workerName} restarted successfully.`);
            fetchStatus();
        } else {
            alert(`Failed to restart worker ${workerName}.`);
        }
    })
    .catch(error => {
        alert(`Error: ${error}`);
    });
}

function restartAllWorkers() {
    fetch('/restartAllWorkers', {
        method: 'POST'
    })
    .then(response => {
        if (response.ok) {
            alert(`All workers restarted successfully.`);
            fetchStatus();
        } else {
            alert(`Failed to restart all workers.`);
        }
    })
    .catch(error => {
        alert(`Error: ${error}`);
    });
}
