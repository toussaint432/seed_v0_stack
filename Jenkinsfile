pipeline {
  agent any

  environment {
    JAVA_HOME = tool(name: 'jdk21', type: 'jdk')
    PATH      = "${env.JAVA_HOME}/bin:${env.PATH}"
  }

  stages {

    stage('Checkout') {
      steps { checkout scm }
    }

    stage('Install seed-common') {
      steps {
        sh 'cd services/seed-common && mvn -B install -DskipTests -q'
      }
    }

    stage('Build Backend') {
      parallel {
        stage('catalog-service') {
          steps { sh 'cd services/catalog-service && mvn -B -DskipTests package -q' }
        }
        stage('lot-service') {
          steps { sh 'cd services/lot-service && mvn -B -DskipTests package -q' }
        }
        stage('stock-service') {
          steps { sh 'cd services/stock-service && mvn -B -DskipTests package -q' }
        }
        stage('order-service') {
          steps { sh 'cd services/order-service && mvn -B -DskipTests package -q' }
        }
      }
    }

    stage('Build Frontend') {
      steps {
        sh 'cd frontend && npm ci && npm run build'
      }
    }

    stage('Docker Build') {
      steps {
        sh 'docker compose build --parallel'
      }
    }

    stage('Deploy') {
      steps {
        sh 'docker compose up -d'
      }
    }

    stage('Smoke Test') {
      steps {
        sh '''
          echo "Attente du démarrage des services..."
          for service in 18081 18082 18083 18084; do
            for i in $(seq 1 12); do
              if curl -sf "http://localhost:${service}/actuator/health" | grep -q '"status":"UP"'; then
                echo "Service :${service} UP"
                break
              fi
              if [ $i -eq 12 ]; then
                echo "ERREUR: service :${service} non disponible après 60s"
                exit 1
              fi
              sleep 5
            done
          done
          echo "Tous les services sont UP."
        '''
      }
    }
  }

  post {
    always {
      archiveArtifacts artifacts: '**/target/*.jar, frontend/dist/**',
                       fingerprint: true,
                       allowEmptyArchive: true
    }
    success {
      echo "Déploiement Sen Jiwu réussi — version $(git rev-parse --short HEAD)"
    }
    failure {
      echo "Pipeline échoué. Consulter les logs du stage en rouge."
    }
  }
}
