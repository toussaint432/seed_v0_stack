pipeline {
  agent any

  environment {
    JAVA_HOME = tool(name: 'jdk17', type: 'jdk')
    PATH = "${env.JAVA_HOME}/bin:${env.PATH}"
  }

  stages {
    stage('Checkout') {
      steps { checkout scm }
    }

    stage('Build Backend') {
      parallel {
        stage('catalog-service') { steps { sh 'cd services/catalog-service && mvn -B -DskipTests package' } }
        stage('lot-service')     { steps { sh 'cd services/lot-service && mvn -B -DskipTests package' } }
        stage('stock-service')   { steps { sh 'cd services/stock-service && mvn -B -DskipTests package' } }
        stage('order-service')   { steps { sh 'cd services/order-service && mvn -B -DskipTests package' } }
      }
    }

    stage('Build Frontend') {
      steps {
        sh 'cd frontend && npm ci && npm run build'
      }
    }

    stage('Docker Build') {
      steps {
        sh 'docker compose build'
      }
    }

    stage('Smoke Test (optional)') {
      steps {
        sh 'echo "Add integration tests here (docker compose up + curl)..."'
      }
    }
  }

  post {
    always {
      archiveArtifacts artifacts: '**/target/*.jar, frontend/dist/**', fingerprint: true, allowEmptyArchive: true
    }
  }
}
